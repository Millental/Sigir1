import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  res.json(departments);
});

router.post("/", async (req, res) => {
  const { name } = req.body ?? {};
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return res.status(400).json({ error: "Укажите название отдела" });
  }

  try {
    const department = await prisma.department.create({ data: { name: trimmed } });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "DEPARTMENT_CREATE", targetType: "Department", targetId: department.id },
    });
    res.status(201).json(department);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Отдел с таким названием уже существует" });
    }
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

router.patch("/:id", async (req, res) => {
  const { name } = req.body ?? {};
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return res.status(400).json({ error: "Укажите название отдела" });
  }

  try {
    const department = await prisma.department.update({ where: { id: req.params.id }, data: { name: trimmed } });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "DEPARTMENT_UPDATE", targetType: "Department", targetId: department.id },
    });
    res.json(department);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Отдел с таким названием уже существует" });
    }
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Отдел не найден" });
    }
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "DEPARTMENT_DELETE", targetType: "Department", targetId: req.params.id },
    });
    res.status(200).json({ id: req.params.id });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Отдел не найден" });
    }
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

export default router;
