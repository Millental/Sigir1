import { Router } from "express";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../utils/hash";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";

const router = Router();

const COOKIE_MAX_AGE_MS = 10 * 60 * 60 * 1000; // 10 часов, см. FR-AUTH-04

router.post("/login", async (req, res) => {
  const { login, password } = req.body ?? {};
  if (!login || !password) {
    return res.status(400).json({ error: "Укажите логин и пароль" });
  }

  // Логин хранится в канонической нижнем регистре (см. users.ts) — приводим ввод так же,
  // чтобы вход не зависел от регистра, которым пользователь набрал логин.
  const user = await prisma.user.findUnique({ where: { login: String(login).trim().toLowerCase() } });

  // Намеренно одинаковое сообщение для «нет пользователя» и «неверный пароль»,
  // чтобы не давать возможность перебором логинов узнавать, какие учётки существуют.
  const genericError = { error: "Неверный логин или пароль" };

  if (!user || !user.isActive) {
    return res.status(401).json(genericError);
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await prisma.auditLogEntry.create({
      data: { userId: user.id, action: "LOGIN_FAILED", details: "Неверный пароль" },
    });
    return res.status(401).json(genericError);
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_MS,
  });

  await prisma.auditLogEntry.create({
    data: { userId: user.id, action: "LOGIN", details: "Успешный вход" },
  });

  res.json({ id: user.id, fullName: user.fullName, role: user.role, login: user.login });
});

router.post("/logout", requireAuth, async (req, res) => {
  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "LOGOUT" },
  });
  res.clearCookie("token");
  res.json({ ok: true });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Укажите текущий и новый пароль" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "Новый пароль должен быть не короче 8 символов" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  const currentOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentOk) {
    return res.status(401).json({ error: "Неверный текущий пароль" });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.auditLogEntry.create({
    data: { userId: user.id, action: "USER_PASSWORD_CHANGE", targetType: "User", targetId: user.id },
  });

  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Пользователь не найден или деактивирован" });
  }
  res.json({ id: user.id, fullName: user.fullName, role: user.role, login: user.login });
});

export default router;
