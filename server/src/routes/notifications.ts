import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { DEADLINE_APPROACHING_HOURS } from "../utils/notifications";

const router = Router();

router.use(requireAuth);

type NotificationTypeName =
  | "CYCLE_ASSEMBLED"
  | "CYCLE_ARCHIVED"
  | "DEADLINE_APPROACHING"
  | "NEEDS_REVISION"
  | "ALL_SUBMITTED";

interface NotificationItem {
  id: string;
  kind: "PERSISTED" | "LIVE";
  type: NotificationTypeName;
  message: string;
  createdAt: string | null;
  readAt: string | null;
  weeklyCycleId: string;
  slideId: string | null;
  templateId: string | null;
}

async function buildDeadlineItems(userId: string): Promise<NotificationItem[]> {
  const slides = await prisma.slide.findMany({
    where: {
      ownerId: userId,
      status: { in: ["DRAFT", "NEEDS_REVISION"] },
      weeklyCycle: {
        status: "COLLECTING",
        deadline: { not: null, lte: new Date(Date.now() + DEADLINE_APPROACHING_HOURS * 60 * 60 * 1000) },
      },
    },
    include: { weeklyCycle: true, template: { select: { id: true, name: true } } },
  });
  return slides.map((s) => ({
    id: `live-deadline:${s.id}`,
    kind: "LIVE" as const,
    type: "DEADLINE_APPROACHING" as const,
    message: `Дедлайн недели «${s.weeklyCycle.weekLabel}» (шаблон «${s.template.name}») приближается — слайд ещё не отправлен`,
    createdAt: null,
    readAt: null,
    weeklyCycleId: s.weeklyCycleId,
    slideId: s.id,
    templateId: s.templateId,
  }));
}

async function buildRevisionItems(userId: string): Promise<NotificationItem[]> {
  const slides = await prisma.slide.findMany({
    where: { ownerId: userId, status: "NEEDS_REVISION" },
    include: { weeklyCycle: true, template: { select: { id: true, name: true } } },
  });
  return slides.map((s) => ({
    id: `live-revision:${s.id}`,
    kind: "LIVE" as const,
    type: "NEEDS_REVISION" as const,
    message: `Слайд «${s.template.name}» недели «${s.weeklyCycle.weekLabel}» возвращён на доработку: ${s.reviewComment ?? ""}`,
    createdAt: null,
    readAt: null,
    weeklyCycleId: s.weeklyCycleId,
    slideId: s.id,
    templateId: s.templateId,
  }));
}

async function buildAllSubmittedItems(): Promise<NotificationItem[]> {
  const cycles = await prisma.weeklyCycle.findMany({
    where: { status: "COLLECTING" },
    include: { slides: { select: { status: true } } },
  });
  return cycles
    .filter((c) => c.slides.length >= 1 && c.slides.every((s) => s.status === "SUBMITTED"))
    .map((c) => ({
      id: `live-submitted:${c.id}`,
      kind: "LIVE" as const,
      type: "ALL_SUBMITTED" as const,
      message: `Все слайды недели «${c.weekLabel}» отправлены на проверку`,
      createdAt: null,
      readAt: null,
      weeklyCycleId: c.id,
      slideId: null,
      templateId: null,
    }));
}

router.get("/", async (req, res) => {
  const { userId, role } = req.user!;

  const persisted = await prisma.notification.findMany({
    where: { recipientId: userId, hiddenAt: null },
    orderBy: { createdAt: "desc" },
  });
  const persistedItems: NotificationItem[] = persisted.map((n) => ({
    id: n.id,
    kind: "PERSISTED",
    type: n.type,
    message: n.message,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
    weeklyCycleId: n.weeklyCycleId,
    slideId: null,
    templateId: null,
  }));

  const liveItems =
    role === "SPEAKER"
      ? [...(await buildDeadlineItems(userId)), ...(await buildRevisionItems(userId))]
      : await buildAllSubmittedItems();

  res.json({
    items: [...liveItems, ...persistedItems],
    unreadCount: persistedItems.filter((i) => i.readAt === null).length,
  });
});

router.post("/:id/read", async (req, res) => {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n || n.recipientId !== req.user!.userId) {
    return res.status(404).json({ error: "Уведомление не найдено" });
  }
  const updated = await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "NOTIFICATION_READ", targetType: "Notification", targetId: n.id },
  });
  res.json(updated);
});

router.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.user!.userId, readAt: null },
    data: { readAt: new Date() },
  });
  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "NOTIFICATION_READ_ALL", targetType: "Notification" },
  });
  res.status(204).end();
});

router.post("/:id/hide", async (req, res) => {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n || n.recipientId !== req.user!.userId) {
    return res.status(404).json({ error: "Уведомление не найдено" });
  }
  const updated = await prisma.notification.update({ where: { id: n.id }, data: { hiddenAt: new Date() } });
  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "NOTIFICATION_HIDE", targetType: "Notification", targetId: n.id },
  });
  res.json(updated);
});

export default router;
