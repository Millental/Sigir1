import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const includeSlide = {
  fieldValues: true,
  template: { include: { fields: { orderBy: { order: "asc" as const } } } },
  weeklyCycle: true,
};

router.get("/", async (req, res) => {
  const slides = await prisma.slide.findMany({
    where: { ownerId: req.user!.userId },
    include: includeSlide,
    orderBy: { createdAt: "desc" },
  });
  res.json(slides);
});

router.get("/:id", async (req, res) => {
  const slide = await prisma.slide.findUnique({ where: { id: req.params.id }, include: includeSlide });
  if (!slide || slide.ownerId !== req.user!.userId) {
    return res.status(404).json({ error: "Слайд не найден" });
  }
  res.json(slide);
});

router.post("/", requireRole("SPEAKER"), async (req, res) => {
  const { weeklyCycleId, templateId } = req.body ?? {};
  if (!weeklyCycleId || !templateId) {
    return res.status(400).json({ error: "Укажите цикл и шаблон" });
  }

  const existing = await prisma.slide.findFirst({
    where: { ownerId: req.user!.userId, weeklyCycleId, templateId },
    include: includeSlide,
  });
  if (existing) return res.json(existing);

  const [cycle, template] = await Promise.all([
    prisma.weeklyCycle.findUnique({ where: { id: weeklyCycleId } }),
    prisma.template.findUnique({ where: { id: templateId }, include: { fields: true } }),
  ]);
  if (!cycle) return res.status(404).json({ error: "Цикл не найден" });
  if (!template) return res.status(404).json({ error: "Шаблон не найден" });
  if (cycle.status !== "COLLECTING") {
    return res.status(403).json({ error: "Цикл закрыт для заполнения" });
  }

  const slide = await prisma.slide.create({
    data: {
      weeklyCycleId,
      templateId,
      ownerId: req.user!.userId,
      fieldValues: {
        create: template.fields.map((f) => ({ templateFieldId: f.id, value: "" })),
      },
    },
    include: includeSlide,
  });

  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "SLIDE_CREATE", targetType: "Slide", targetId: slide.id },
  });

  res.status(201).json(slide);
});

router.patch("/:id", requireRole("SPEAKER"), async (req, res) => {
  const { values } = req.body ?? {};
  if (!Array.isArray(values)) {
    return res.status(400).json({ error: "Укажите значения полей" });
  }

  const slide = await prisma.slide.findUnique({
    where: { id: req.params.id },
    include: { fieldValues: true, weeklyCycle: true },
  });
  if (!slide || slide.ownerId !== req.user!.userId) {
    return res.status(404).json({ error: "Слайд не найден" });
  }
  if (slide.status !== "DRAFT") {
    return res.status(403).json({ error: "Слайд уже отправлен и недоступен для редактирования" });
  }
  if (slide.weeklyCycle.status !== "COLLECTING") {
    return res.status(403).json({ error: "Цикл закрыт для редактирования" });
  }

  const byFieldId = new Map(slide.fieldValues.map((v) => [v.templateFieldId, v]));

  await prisma.$transaction(async (tx) => {
    for (const { templateFieldId, value } of values as Array<{ templateFieldId: string; value: string }>) {
      const current = byFieldId.get(templateFieldId);
      if (!current || current.value === value) continue;

      await tx.fieldValueHistory.create({
        data: {
          slideFieldValueId: current.id,
          oldValue: current.value,
          newValue: value ?? "",
          changedBy: req.user!.userId,
        },
      });
      await tx.slideFieldValue.update({ where: { id: current.id }, data: { value: value ?? "" } });
    }
  });

  const updated = await prisma.slide.findUnique({ where: { id: slide.id }, include: includeSlide });
  res.json(updated);
});

export default router;
