import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { hashPassword } from "../utils/hash";

const router = Router();

// Весь модуль доступен только администратору (FR-USR-*).
router.use(requireAuth, requireRole("ADMIN"));

function generateTempPassword(): string {
  return crypto.randomBytes(6).toString("hex");
}

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, login: true, role: true, isActive: true, createdAt: true },
    orderBy: { fullName: "asc" },
  });
  res.json(users);
});

router.post("/", async (req, res) => {
  const { fullName, login, role } = req.body ?? {};
  if (!fullName || !login) {
    return res.status(400).json({ error: "Укажите ФИО и логин" });
  }

  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      fullName,
      login,
      role: role === "ADMIN" ? "ADMIN" : "SPEAKER",
      passwordHash,
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
    tempPassword,
  });
});

router.patch("/:id", async (req, res) => {
  const { fullName, role, isActive } = req.body ?? {};
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "USER_UPDATE", targetType: "User", targetId: user.id },
    });
    res.json({ id: user.id, fullName: user.fullName, role: user.role, isActive: user.isActive });
  } catch {
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

export default router;
