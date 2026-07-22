import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { assertPresentationReadAccess, PresentationAccessError } from "../utils/presentationAccess";
import { notifyCycleSlideOwners } from "../utils/notifications";

const router = Router();

router.use(requireAuth);

const includeSlideForSlot = {
  owner: { select: { id: true, fullName: true, login: true } },
  template: {
    include: {
      fields: { orderBy: { order: "asc" as const } },
      blocks: { orderBy: { order: "asc" as const } },
    },
  },
  fieldValues: true,
  blockValues: true,
};

const includePresentation = {
  slides: {
    orderBy: { order: "asc" as const },
    include: { slide: { include: includeSlideForSlot } },
  },
};

async function getOrCreatePresentation(
  tx: Prisma.TransactionClient,
  weeklyCycleId: string,
  userId: string
) {
  const existing = await tx.presentation.findUnique({ where: { weeklyCycleId } });
  if (existing) return existing;

  const presentation = await tx.presentation.create({ data: { weeklyCycleId } });
  const cycle = await tx.weeklyCycle.update({ where: { id: weeklyCycleId }, data: { status: "ASSEMBLED" } });
  await tx.auditLogEntry.create({
    data: {
      userId,
      action: "PRESENTATION_ASSEMBLE",
      targetType: "WeeklyCycle",
      targetId: weeklyCycleId,
    },
  });
  await notifyCycleSlideOwners(tx, weeklyCycleId, "CYCLE_ASSEMBLED", `Презентация недели «${cycle.weekLabel}» собрана`);
  return presentation;
}

router.get("/cycle/:weeklyCycleId", async (req, res) => {
  const weeklyCycle = await prisma.weeklyCycle.findUnique({ where: { id: req.params.weeklyCycleId } });
  if (!weeklyCycle) return res.status(404).json({ error: "Цикл не найден" });
  try {
    assertPresentationReadAccess(weeklyCycle, req.user!);
  } catch (err) {
    if (err instanceof PresentationAccessError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const presentation = await prisma.presentation.findUnique({
    where: { weeklyCycleId: weeklyCycle.id },
    include: includePresentation,
  });

  const candidateSlides =
    req.user!.role === "ADMIN"
      ? await prisma.slide.findMany({
          where: { weeklyCycleId: weeklyCycle.id, status: "SUBMITTED" },
          include: includeSlideForSlot,
          orderBy: [{ owner: { fullName: "asc" } }, { template: { name: "asc" } }],
        })
      : [];

  res.json({ weeklyCycle, presentation, candidateSlides });
});

router.post("/cycle/:weeklyCycleId/slides", requireRole("ADMIN"), async (req, res) => {
  const { slideId } = req.body ?? {};
  if (!slideId) return res.status(400).json({ error: "Укажите слайд" });

  const weeklyCycleId = req.params.weeklyCycleId;
  const slide = await prisma.slide.findUnique({ where: { id: slideId } });
  if (!slide || slide.weeklyCycleId !== weeklyCycleId) {
    return res.status(404).json({ error: "Слайд не найден в этом цикле" });
  }
  if (slide.status !== "SUBMITTED") {
    return res.status(403).json({ error: "Слайд не готов к включению в презентацию" });
  }

  try {
    const presentation = await prisma.$transaction(async (tx) => {
      const presentation = await getOrCreatePresentation(tx, weeklyCycleId, req.user!.userId);

      const maxOrder = await tx.presentationSlide.aggregate({
        where: { presentationId: presentation.id },
        _max: { order: true },
      });
      const order = (maxOrder._max.order ?? -1) + 1;

      await tx.presentationSlide.create({ data: { presentationId: presentation.id, slideId, order } });
      await tx.slide.update({ where: { id: slideId }, data: { status: "IN_PRESENTATION" } });
      await tx.auditLogEntry.create({
        data: {
          userId: req.user!.userId,
          action: "PRESENTATION_SLIDE_ADD",
          targetType: "Slide",
          targetId: slideId,
          details: presentation.id,
        },
      });

      return tx.presentation.findUniqueOrThrow({ where: { id: presentation.id }, include: includePresentation });
    });

    res.status(201).json(presentation);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "Презентация уже собирается — обновите страницу и попробуйте снова" });
    }
    throw err;
  }
});

router.post("/cycle/:weeklyCycleId/placeholders", requireRole("ADMIN"), async (req, res) => {
  const { label } = req.body ?? {};
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "Укажите текст заглушки" });
  }

  const weeklyCycleId = req.params.weeklyCycleId;
  const weeklyCycle = await prisma.weeklyCycle.findUnique({ where: { id: weeklyCycleId } });
  if (!weeklyCycle) return res.status(404).json({ error: "Цикл не найден" });

  try {
    const presentation = await prisma.$transaction(async (tx) => {
      const presentation = await getOrCreatePresentation(tx, weeklyCycleId, req.user!.userId);

      const maxOrder = await tx.presentationSlide.aggregate({
        where: { presentationId: presentation.id },
        _max: { order: true },
      });
      const order = (maxOrder._max.order ?? -1) + 1;

      await tx.presentationSlide.create({
        data: { presentationId: presentation.id, slideId: null, placeholderLabel: label.trim(), order },
      });
      await tx.auditLogEntry.create({
        data: {
          userId: req.user!.userId,
          action: "PRESENTATION_PLACEHOLDER_ADD",
          targetType: "Presentation",
          targetId: presentation.id,
          details: label.trim(),
        },
      });

      return tx.presentation.findUniqueOrThrow({ where: { id: presentation.id }, include: includePresentation });
    });

    res.status(201).json(presentation);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "Презентация уже собирается — обновите страницу и попробуйте снова" });
    }
    throw err;
  }
});

router.patch("/cycle/:weeklyCycleId/order", requireRole("ADMIN"), async (req, res) => {
  const { order } = req.body ?? {};
  if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
    return res.status(400).json({ error: "Некорректный порядок слотов" });
  }

  const weeklyCycleId = req.params.weeklyCycleId;
  const presentation = await prisma.presentation.findUnique({
    where: { weeklyCycleId },
    include: { slides: true },
  });
  if (!presentation) return res.status(404).json({ error: "Презентация ещё не собрана" });

  const currentIds = new Set(presentation.slides.map((s) => s.id));
  const incomingIds = new Set(order as string[]);
  const isValidPermutation =
    (order as string[]).length === presentation.slides.length &&
    incomingIds.size === (order as string[]).length &&
    [...currentIds].every((id) => incomingIds.has(id));
  if (!isValidPermutation) {
    return res.status(400).json({ error: "Некорректный порядок слотов" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await Promise.all(
      (order as string[]).map((id, index) => tx.presentationSlide.update({ where: { id }, data: { order: index } }))
    );
    await tx.auditLogEntry.create({
      data: {
        userId: req.user!.userId,
        action: "PRESENTATION_REORDER",
        targetType: "Presentation",
        targetId: presentation.id,
      },
    });
    return tx.presentation.findUniqueOrThrow({ where: { id: presentation.id }, include: includePresentation });
  });

  res.json(updated);
});

router.delete("/slots/:presentationSlideId", requireRole("ADMIN"), async (req, res) => {
  const slot = await prisma.presentationSlide.findUnique({ where: { id: req.params.presentationSlideId } });
  if (!slot) return res.status(404).json({ error: "Слот не найден" });

  const presentation = await prisma.$transaction(async (tx) => {
    await tx.presentationSlide.delete({ where: { id: slot.id } });

    if (slot.slideId) {
      await tx.slide.update({ where: { id: slot.slideId }, data: { status: "SUBMITTED" } });
      await tx.auditLogEntry.create({
        data: {
          userId: req.user!.userId,
          action: "PRESENTATION_SLIDE_REMOVE",
          targetType: "Slide",
          targetId: slot.slideId,
        },
      });
    } else {
      await tx.auditLogEntry.create({
        data: {
          userId: req.user!.userId,
          action: "PRESENTATION_PLACEHOLDER_REMOVE",
          targetType: "Presentation",
          targetId: slot.presentationId,
          details: slot.placeholderLabel,
        },
      });
    }

    return tx.presentation.findUniqueOrThrow({ where: { id: slot.presentationId }, include: includePresentation });
  });

  res.json(presentation);
});

export default router;
