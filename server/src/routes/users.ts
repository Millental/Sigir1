import { Router } from "express";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { hashPassword } from "../utils/hash";

const router = Router();

// Весь модуль доступен только администратору (FR-USR-*).
router.use(requireAuth, requireRole("ADMIN"));

function generateTempPassword(): string {
  return crypto.randomBytes(6).toString("hex");
}

function isSelf(req: { user?: { userId: string } }, targetId: string): boolean {
  return req.user!.userId === targetId;
}

// true только если targetUserId сейчас сам активный ADMIN и после операции над ним
// в системе не останется ни одного другого активного ADMIN.
async function isLastActiveAdmin(targetUserId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, isActive: true } });
  if (!target || target.role !== "ADMIN" || !target.isActive) return false;
  const otherActiveAdmins = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: targetUserId } },
  });
  return otherActiveAdmins === 0;
}

async function departmentExists(departmentId: string): Promise<boolean> {
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  return department !== null;
}

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      login: true,
      role: true,
      isActive: true,
      createdAt: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { fullName: "asc" },
  });
  res.json(users);
});

router.post("/", async (req, res) => {
  const { fullName, login, role, departmentId } = req.body ?? {};
  if (!fullName || !login) {
    return res.status(400).json({ error: "Укажите ФИО и логин" });
  }

  // Логин всегда хранится в нижнем регистре — вход в auth.ts приводит ввод так же,
  // это делает логин фактически нечувствительным к регистру.
  const normalizedLogin = String(login).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { login: normalizedLogin } });
  if (existing) {
    return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
  }

  if (departmentId !== undefined && departmentId !== null && !(await departmentExists(departmentId))) {
    return res.status(400).json({ error: "Отдел не найден" });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      fullName,
      login: normalizedLogin,
      role: role === "ADMIN" ? "ADMIN" : "SPEAKER",
      passwordHash,
      departmentId: departmentId ?? null,
    },
  });

  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "USER_CREATE", targetType: "User", targetId: user.id },
  });

  // Временный пароль отдаётся один раз в ответе API.
  // Полноценная рассылка приглашений по e-mail — предмет Этапа 10, здесь не реализована.
  res.status(201).json({
    id: user.id,
    fullName: user.fullName,
    login: user.login,
    role: user.role,
    departmentId: user.departmentId,
    tempPassword,
  });
});

router.patch("/:id", async (req, res) => {
  const { fullName, login, role, isActive, departmentId } = req.body ?? {};

  if (isSelf(req, req.params.id) && (role !== undefined || isActive !== undefined)) {
    return res.status(400).json({ error: "Нельзя изменить роль или активность собственной учётной записи" });
  }

  const isDemotion = role !== undefined && role !== "ADMIN";
  const isDeactivation = isActive === false;
  if (!isSelf(req, req.params.id) && (isDemotion || isDeactivation) && (await isLastActiveAdmin(req.params.id))) {
    return res.status(400).json({ error: "Нельзя понизить или деактивировать последнего активного администратора" });
  }

  if (departmentId !== undefined && departmentId !== null && !(await departmentExists(departmentId))) {
    return res.status(400).json({ error: "Отдел не найден" });
  }

  let normalizedLogin: string | undefined;
  if (login !== undefined) {
    normalizedLogin = String(login).trim().toLowerCase();
    if (!normalizedLogin) {
      return res.status(400).json({ error: "Логин не может быть пустым" });
    }
    const conflict = await prisma.user.findFirst({
      where: { login: normalizedLogin, NOT: { id: req.params.id } },
      select: { id: true },
    });
    if (conflict) {
      return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(normalizedLogin !== undefined ? { login: normalizedLogin } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
      },
    });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "USER_UPDATE", targetType: "User", targetId: user.id },
    });
    res.json({
      id: user.id,
      fullName: user.fullName,
      login: user.login,
      role: user.role,
      isActive: user.isActive,
      departmentId: user.departmentId,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
    }
    res.status(404).json({ error: "Пользователь не найден" });
  }
});

router.post("/:id/reset-password", async (req, res) => {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "USER_PASSWORD_RESET", targetType: "User", targetId: req.params.id },
    });
    res.json({ tempPassword });
  } catch {
    res.status(404).json({ error: "Пользователь не найден" });
  }
});

router.delete("/:id", async (req, res) => {
  if (isSelf(req, req.params.id)) {
    return res.status(400).json({ error: "Нельзя удалить собственную учётную запись" });
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!target) {
    return res.status(404).json({ error: "Пользователь не найден" });
  }

  if (await isLastActiveAdmin(req.params.id)) {
    return res.status(400).json({ error: "Нельзя удалить последнего активного администратора" });
  }

  const [slideCount, notificationCount] = await Promise.all([
    prisma.slide.count({ where: { ownerId: req.params.id } }),
    prisma.notification.count({ where: { recipientId: req.params.id } }),
  ]);
  if (slideCount > 0 || notificationCount > 0) {
    return res.status(409).json({
      error: "Нельзя удалить — учётная запись уже использовалась в системе (есть слайды или уведомления). Используйте деактивацию.",
    });
  }

  try {
    await prisma.user.delete({ where: { id: req.params.id } });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Пользователь не найден" });
    }
    if (err?.code === "P2003") {
      return res.status(409).json({
        error: "Нельзя удалить — учётная запись уже использовалась в системе (есть слайды или уведомления). Используйте деактивацию.",
      });
    }
    console.error(err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }

  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "USER_DELETE", targetType: "User", targetId: req.params.id },
  });

  res.status(200).json({ id: req.params.id });
});

export default router;
