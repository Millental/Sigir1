import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const cycles = await prisma.weeklyCycle.findMany({ orderBy: { startDate: "desc" } });
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
  try {
    const cycle = await prisma.weeklyCycle.update({
      where: { id: req.params.id },
      data: {
        ...(weekLabel !== undefined ? { weekLabel } : {}),
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
        ...(status !== undefined ? { status } : {}),
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

export default router;
