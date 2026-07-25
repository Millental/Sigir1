import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { notifyCycleSlideOwners } from "../utils/notifications";

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
  const { weekLabel, startDate, endDate, deadline, status } = req.body ?? {};
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
        ...(deadline !== undefined ? { deadline: deadline === null ? null : new Date(deadline) } : {}),
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

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.weeklyCycle.update({
      where: { id: cycle.id },
      data: { status: "ARCHIVED" },
    });
    await tx.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "CYCLE_ARCHIVE", targetType: "WeeklyCycle", targetId: cycle.id },
    });
    await notifyCycleSlideOwners(tx, cycle.id, "CYCLE_ARCHIVED", `Презентация недели «${c.weekLabel}» архивирована`);
    return c;
  });
  res.json(updated);
});

router.post("/:id/unarchive", requireRole("ADMIN"), async (req, res) => {
  const cycle = await prisma.weeklyCycle.findUnique({
    where: { id: req.params.id },
    include: { presentation: true },
  });
  if (!cycle) return res.status(404).json({ error: "Цикл не найден" });
  if (cycle.status !== "ARCHIVED") {
    return res.status(409).json({ error: "Разархивировать можно только цикл в статусе «Архив»" });
  }

  // Архивация возможна только из ASSEMBLED и не удаляет Presentation (в отличие от разборки),
  // поэтому у ARCHIVED-цикла презентация в норме всегда есть — но на случай той же аномалии
  // рассинхронизации, что уже встречалась (см. disassemble выше), самовосстанавливаемся в
  // COLLECTING вместо 409, а не оставляем цикл замороженным без выхода.
  const targetStatus = cycle.presentation ? "ASSEMBLED" : "COLLECTING";

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.weeklyCycle.update({
      where: { id: cycle.id },
      data: { status: targetStatus },
    });
    await tx.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "CYCLE_UNARCHIVE", targetType: "WeeklyCycle", targetId: cycle.id },
    });
    return c;
  });
  res.json(updated);
});

router.post("/:id/send-reminder", requireRole("ADMIN"), async (req, res) => {
  const { recipientIds, message } = req.body ?? {};
  if (!Array.isArray(recipientIds) || recipientIds.length === 0 || recipientIds.some((id) => typeof id !== "string")) {
    return res.status(400).json({ error: "Укажите получателей" });
  }
  if (message !== undefined && typeof message !== "string") {
    return res.status(400).json({ error: "Некорректное сообщение" });
  }

  const cycle = await prisma.weeklyCycle.findUnique({ where: { id: req.params.id } });
  if (!cycle) return res.status(404).json({ error: "Цикл не найден" });
  if (cycle.status !== "COLLECTING") {
    return res.status(409).json({ error: "Напоминание можно отправить только по циклу в статусе «Сбор»" });
  }

  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds }, role: "SPEAKER", isActive: true },
    select: { id: true },
  });
  if (recipients.length === 0) {
    return res.status(400).json({ error: "Среди получателей нет активных спикеров" });
  }

  const text = message?.trim()
    ? `Напоминание от администратора: подготовьте слайд к дедлайну недели «${cycle.weekLabel}». ${message.trim()}`
    : `Напоминание от администратора: подготовьте слайд к дедлайну недели «${cycle.weekLabel}»`;

  await prisma.$transaction(async (tx) => {
    await tx.notification.createMany({
      data: recipients.map((r) => ({
        recipientId: r.id,
        type: "ADMIN_REMINDER",
        weeklyCycleId: cycle.id,
        message: text,
      })),
    });
    await tx.auditLogEntry.create({
      data: {
        userId: req.user!.userId,
        action: "CYCLE_SEND_REMINDER",
        targetType: "WeeklyCycle",
        targetId: cycle.id,
        details: `получателей: ${recipients.length}`,
      },
    });
  });

  res.status(201).json({ sent: recipients.length });
});

export default router;
