import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const where = req.user!.role === "SPEAKER" ? { status: { not: "ARCHIVED" as const } } : {};
  const cycles = await prisma.weeklyCycle.findMany({ where, orderBy: { startDate: "desc" } });
  res.json(cycles);
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { weekLabel, startDate, endDate } = req.body ?? {};
  if (!weekLabel || !startDate || !endDate) {
    return res.status(400).json({ error: "Укажите название недели, дату начала и дату окончания" });
  }

  const cycle = await prisma.weeklyCycle.create({
    data: { weekLabel, startDate: new Date(startDate), endDate: new Date(endDate) },
  });

  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "CYCLE_CREATE", targetType: "WeeklyCycle", targetId: cycle.id },
  });

  res.status(201).json(cycle);
});

router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const { weekLabel, startDate, endDate, status } = req.body ?? {};
  if (status !== undefined) {
    return res.status(400).json({
      error: "Статус меняется через отдельные действия — сборку презентации или архивацию",
    });
  }
  try {
    const cycle = await prisma.weeklyCycle.update({
      where: { id: req.params.id },
      data: {
        ...(weekLabel !== undefined ? { weekLabel } : {}),
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
      },
    });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "CYCLE_UPDATE", targetType: "WeeklyCycle", targetId: cycle.id },
    });
    res.json(cycle);
  } catch {
    res.status(404).json({ error: "Цикл не найден" });
  }
});

router.post("/:id/archive", requireRole("ADMIN"), async (req, res) => {
  const cycle = await prisma.weeklyCycle.findUnique({
    where: { id: req.params.id },
    include: { presentation: true },
  });
  if (!cycle) return res.status(404).json({ error: "Цикл не найден" });
  if (cycle.status !== "ASSEMBLED" || !cycle.presentation) {
    return res.status(409).json({ error: "Архивировать можно только уже собранную презентацию" });
  }

  const updated = await prisma.weeklyCycle.update({
    where: { id: cycle.id },
    data: { status: "ARCHIVED" },
  });
  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "CYCLE_ARCHIVE", targetType: "WeeklyCycle", targetId: cycle.id },
  });
  res.json(updated);
});

export default router;
