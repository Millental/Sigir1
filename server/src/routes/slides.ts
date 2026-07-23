import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  CHART_IMAGE_DIR,
  MAX_CHART_IMAGE_BYTES,
  CHART_IMAGE_CONTENT_TYPES,
  detectChartImageFormat,
} from "../utils/chartImageStorage";
import { stableStringify } from "../utils/stableStringify";

const router = Router();

router.use(requireAuth);

const includeSlide = {
  fieldValues: true,
  blockValues: true,
  template: {
    include: {
      fields: { orderBy: { order: "asc" as const } },
      blocks: { orderBy: { order: "asc" as const } },
    },
  },
  weeklyCycle: true,
  owner: { select: { id: true, fullName: true, login: true } },
};

type BlockType = "METRIC_TILE" | "RICH_TEXT_SECTION" | "TABLE" | "FOOTER_STATS" | "CHART_IMAGE";

function defaultValueFor(blockType: BlockType): unknown {
  if (blockType === "TABLE") return { rows: [] };
  if (blockType === "METRIC_TILE") return { value: "" };
  if (blockType === "CHART_IMAGE") return { path: null };
  return { text: "" };
}

function validateBlockValue(blockType: BlockType, config: any, value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Некорректное значение блока";
  }
  const v = value as Record<string, unknown>;

  if (blockType === "RICH_TEXT_SECTION" || blockType === "FOOTER_STATS") {
    if (typeof v.text !== "string") return "Значение текстового блока должно быть строкой";
    return null;
  }

  if (blockType === "METRIC_TILE") {
    for (const key of ["value", "plan", "fact", "percent"]) {
      if (v[key] !== undefined && typeof v[key] !== "string") {
        return "Значения метрики должны быть строками";
      }
    }
    return null;
  }

  if (blockType === "CHART_IMAGE") {
    if (v.path !== null && typeof v.path !== "string") {
      return "Некорректное значение блока-изображения";
    }
    return null;
  }

  // TABLE
  if (!Array.isArray(v.rows)) return "Значение таблицы должно содержать список строк";
  const columnsLength = Array.isArray(config?.columns) ? config.columns.length : 0;
  for (const row of v.rows) {
    if (!Array.isArray(row) || row.length !== columnsLength || row.some((cell) => typeof cell !== "string")) {
      return "Число ячеек в строке таблицы не совпадает с числом колонок шаблона";
    }
  }
  return null;
}

const chartImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHART_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const okExt = name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
    const okMime = file.mimetype === "image/png" || file.mimetype === "image/jpeg";
    if (okExt && okMime) return cb(null, true);
    cb(new Error("Допустимы только файлы PNG и JPG/JPEG"));
  },
});

function loadSlideForImageMutation(slideId: string) {
  return prisma.slide.findUnique({
    where: { id: slideId },
    include: { weeklyCycle: true, template: { include: { blocks: true } }, blockValues: true },
  });
}

function checkImageMutationAccess(
  slide: { ownerId: string; status: string; weeklyCycle: { status: string } },
  user: { userId: string; role: "ADMIN" | "SPEAKER" }
): { status: number; error: string } | null {
  if (user.role === "SPEAKER" && slide.ownerId !== user.userId) {
    return { status: 404, error: "Слайд не найден" };
  }
  if (slide.status !== "DRAFT" && slide.status !== "NEEDS_REVISION") {
    return { status: 403, error: "Слайд уже отправлен и недоступен для редактирования" };
  }
  if (slide.weeklyCycle.status !== "COLLECTING") {
    return { status: 403, error: "Цикл закрыт для редактирования" };
  }
  return null;
}

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

router.get("/:id/history", async (req, res) => {
  // Отдельная проверка доступа, не переиспользует GET /:id — тому нет обхода для ADMIN, а
  // историю (в отличие от мутаций Этапа 7) читать может ADMIN на любом слайде, без статусных
  // ограничений: она не зависит от текущего состояния слайда/цикла.
  const slide = await prisma.slide.findUnique({ where: { id: req.params.id } });
  if (!slide || (req.user!.role !== "ADMIN" && slide.ownerId !== req.user!.userId)) {
    return res.status(404).json({ error: "Слайд не найден" });
  }

  const [fieldHistory, blockHistory] = await Promise.all([
    prisma.fieldValueHistory.findMany({
      where: { slideFieldValue: { slideId: slide.id } },
      include: { slideFieldValue: { include: { templateField: true } } },
    }),
    prisma.blockValueHistory.findMany({
      where: { slideBlockValue: { slideId: slide.id } },
      include: { slideBlockValue: { include: { templateBlock: true } } },
    }),
  ]);

  const changedByIds = [...new Set([...fieldHistory, ...blockHistory].map((h) => h.changedBy))];
  const users = await prisma.user.findMany({ where: { id: { in: changedByIds } }, select: { id: true, fullName: true } });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  const items = [
    ...fieldHistory.map((h) => ({
      kind: "field" as const,
      label: h.slideFieldValue.templateField.label,
      oldValue: h.oldValue as unknown,
      newValue: h.newValue as unknown,
      changedBy: { id: h.changedBy, fullName: nameById.get(h.changedBy) ?? "?" },
      changedAt: h.changedAt,
    })),
    ...blockHistory.map((h) => ({
      kind: "block" as const,
      label: h.slideBlockValue.templateBlock.label,
      blockType: h.slideBlockValue.templateBlock.blockType,
      oldValue: h.oldValue as unknown,
      newValue: h.newValue as unknown,
      changedBy: { id: h.changedBy, fullName: nameById.get(h.changedBy) ?? "?" },
      changedAt: h.changedAt,
    })),
  ].sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

  res.json({ items });
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
    prisma.template.findUnique({ where: { id: templateId }, include: { fields: true, blocks: true } }),
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
      ...(template.layoutKind === null
        ? { fieldValues: { create: template.fields.map((f) => ({ templateFieldId: f.id, value: "" })) } }
        : {
            blockValues: {
              create: template.blocks.map((b) => ({
                templateBlockId: b.id,
                value: defaultValueFor(b.blockType as BlockType) as any,
              })),
            },
          }),
    },
    include: includeSlide,
  });

  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "SLIDE_CREATE", targetType: "Slide", targetId: slide.id },
  });

  res.status(201).json(slide);
});

router.post("/:id/submit", requireRole("SPEAKER"), async (req, res) => {
  const slide = await prisma.slide.findUnique({
    where: { id: req.params.id },
    include: { weeklyCycle: true },
  });
  if (!slide || slide.ownerId !== req.user!.userId) {
    return res.status(404).json({ error: "Слайд не найден" });
  }
  if (slide.status !== "DRAFT" && slide.status !== "NEEDS_REVISION") {
    return res.status(403).json({ error: "Слайд уже отправлен на проверку" });
  }
  if (slide.weeklyCycle.status !== "COLLECTING") {
    return res.status(403).json({ error: "Цикл закрыт для редактирования" });
  }

  const updated = await prisma.slide.update({
    where: { id: slide.id },
    data: { status: "SUBMITTED", reviewComment: null },
    include: includeSlide,
  });

  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "SLIDE_SUBMIT", targetType: "Slide", targetId: slide.id },
  });

  res.json(updated);
});

router.patch("/:id", requireRole("SPEAKER"), async (req, res) => {
  const { values, blockValues } = req.body ?? {};

  const slide = await prisma.slide.findUnique({
    where: { id: req.params.id },
    include: {
      fieldValues: true,
      blockValues: true,
      weeklyCycle: true,
      template: { include: { blocks: true } },
    },
  });
  if (!slide || slide.ownerId !== req.user!.userId) {
    return res.status(404).json({ error: "Слайд не найден" });
  }
  if (slide.status !== "DRAFT" && slide.status !== "NEEDS_REVISION") {
    return res.status(403).json({ error: "Слайд уже отправлен и недоступен для редактирования" });
  }
  if (slide.weeklyCycle.status !== "COLLECTING") {
    return res.status(403).json({ error: "Цикл закрыт для редактирования" });
  }

  const isBlockTemplate = slide.template.layoutKind !== null;

  if (isBlockTemplate) {
    if (values !== undefined) {
      return res.status(400).json({ error: "Этот шаблон использует блоки, а не поля" });
    }
    if (!Array.isArray(blockValues)) {
      return res.status(400).json({ error: "Укажите значения блоков" });
    }

    const blockById = new Map(slide.template.blocks.map((b) => [b.id, b]));
    const currentByBlockId = new Map(slide.blockValues.map((v) => [v.templateBlockId, v]));

    for (const entry of blockValues as Array<{ templateBlockId: string; value: unknown }>) {
      const block = blockById.get(entry.templateBlockId);
      const current = currentByBlockId.get(entry.templateBlockId);
      if (!block || !current) {
        return res.status(400).json({ error: "Неизвестный блок шаблона" });
      }
      if (block.blockType === "CHART_IMAGE") {
        if (stableStringify(entry.value) !== stableStringify(current.value)) {
          return res.status(400).json({
            error: "Изображение для этого блока меняется отдельным запросом загрузки/удаления",
          });
        }
        continue;
      }
      const error = validateBlockValue(block.blockType as BlockType, block.config, entry.value);
      if (error) return res.status(400).json({ error });
    }

    await prisma.$transaction(async (tx) => {
      for (const { templateBlockId, value } of blockValues as Array<{ templateBlockId: string; value: unknown }>) {
        const current = currentByBlockId.get(templateBlockId)!;
        if (stableStringify(current.value) === stableStringify(value)) continue;

        await tx.blockValueHistory.create({
          data: {
            slideBlockValueId: current.id,
            oldValue: current.value as any,
            newValue: value as any,
            changedBy: req.user!.userId,
          },
        });
        await tx.slideBlockValue.update({ where: { id: current.id }, data: { value: value as any } });
      }
    });
  } else {
    if (blockValues !== undefined) {
      return res.status(400).json({ error: "Этот шаблон использует поля, а не блоки" });
    }
    if (!Array.isArray(values)) {
      return res.status(400).json({ error: "Укажите значения полей" });
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
  }

  const updated = await prisma.slide.findUnique({ where: { id: slide.id }, include: includeSlide });
  res.json(updated);
});

router.get("/cycle/:weeklyCycleId", requireRole("ADMIN"), async (req, res) => {
  const slides = await prisma.slide.findMany({
    where: { weeklyCycleId: req.params.weeklyCycleId },
    include: includeSlide,
    orderBy: [{ owner: { fullName: "asc" } }, { template: { name: "asc" } }],
  });
  res.json(slides);
});

router.patch("/:id/review", requireRole("ADMIN"), async (req, res) => {
  const { action, comment } = req.body ?? {};

  const slide = await prisma.slide.findUnique({ where: { id: req.params.id } });
  if (!slide) return res.status(404).json({ error: "Слайд не найден" });
  if (slide.status !== "SUBMITTED") {
    return res.status(403).json({ error: "Слайд не находится на проверке" });
  }

  if (action === "approve") {
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "SLIDE_APPROVE", targetType: "Slide", targetId: slide.id },
    });
    const current = await prisma.slide.findUnique({ where: { id: slide.id }, include: includeSlide });
    return res.json(current);
  }

  if (action === "request_revision") {
    if (typeof comment !== "string" || !comment.trim()) {
      return res.status(400).json({ error: "Укажите комментарий для доработки" });
    }
    const updated = await prisma.slide.update({
      where: { id: slide.id },
      data: { status: "NEEDS_REVISION", reviewComment: comment.trim() },
      include: includeSlide,
    });
    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "SLIDE_REQUEST_REVISION", targetType: "Slide", targetId: slide.id },
    });
    return res.json(updated);
  }

  res.status(400).json({ error: "Неизвестное действие" });
});

router.post(
  "/:id/blocks/:templateBlockId/chart-image",
  requireRole("SPEAKER", "ADMIN"),
  chartImageUpload.single("file"),
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        error: err.code === "LIMIT_FILE_SIZE" ? "Файл больше 5 МБ" : "Не удалось загрузить файл",
      });
    }
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Не удалось загрузить файл" });
    }
    next();
  },
  async (req: Request, res: Response) => {
    const slide = await loadSlideForImageMutation(req.params.id);
    if (!slide) return res.status(404).json({ error: "Слайд не найден" });
    const authError = checkImageMutationAccess(slide, req.user!);
    if (authError) return res.status(authError.status).json({ error: authError.error });

    const block = slide.template.blocks.find((b) => b.id === req.params.templateBlockId);
    if (!block || block.blockType !== "CHART_IMAGE") {
      return res.status(400).json({ error: "Блок не найден или не является изображением" });
    }
    const current = slide.blockValues.find((v) => v.templateBlockId === block.id);
    if (!current) return res.status(400).json({ error: "Значение блока не найдено" });
    if (!req.file) return res.status(400).json({ error: "Выберите файл изображения" });

    const format = detectChartImageFormat(req.file.buffer);
    if (!format) return res.status(400).json({ error: "Файл повреждён или не является PNG/JPEG" });

    const oldPath = (current.value as { path?: string | null } | null)?.path ?? null;
    const assetId = crypto.randomUUID();
    await fs.writeFile(path.join(CHART_IMAGE_DIR, assetId), req.file.buffer);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.chartImageAsset.deleteMany({ where: { slideBlockValueId: current.id } });
        await tx.chartImageAsset.create({
          data: {
            id: assetId,
            slideBlockValueId: current.id,
            extension: format.extension,
            mimeType: format.mimeType,
            originalFilename: req.file!.originalname,
            sizeBytes: req.file!.size,
            uploadedBy: req.user!.userId,
          },
        });
        await tx.blockValueHistory.create({
          data: {
            slideBlockValueId: current.id,
            oldValue: current.value as any,
            newValue: { path: assetId } as any,
            changedBy: req.user!.userId,
          },
        });
        await tx.slideBlockValue.update({ where: { id: current.id }, data: { value: { path: assetId } as any } });
      });
    } catch (err) {
      await fs.unlink(path.join(CHART_IMAGE_DIR, assetId)).catch(() => {});
      throw err;
    }

    if (oldPath) {
      await fs.unlink(path.join(CHART_IMAGE_DIR, oldPath)).catch(() => {});
    }

    res.json({ templateBlockId: block.id, value: { path: assetId } });
  }
);

router.delete(
  "/:id/blocks/:templateBlockId/chart-image",
  requireRole("SPEAKER", "ADMIN"),
  async (req: Request, res: Response) => {
    const slide = await loadSlideForImageMutation(req.params.id);
    if (!slide) return res.status(404).json({ error: "Слайд не найден" });
    const authError = checkImageMutationAccess(slide, req.user!);
    if (authError) return res.status(authError.status).json({ error: authError.error });

    const block = slide.template.blocks.find((b) => b.id === req.params.templateBlockId);
    if (!block || block.blockType !== "CHART_IMAGE") {
      return res.status(400).json({ error: "Блок не найден или не является изображением" });
    }
    const current = slide.blockValues.find((v) => v.templateBlockId === block.id);
    if (!current) return res.status(400).json({ error: "Значение блока не найдено" });

    const oldPath = (current.value as { path?: string | null } | null)?.path ?? null;
    if (!oldPath) {
      return res.json({ templateBlockId: block.id, value: { path: null } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.chartImageAsset.deleteMany({ where: { slideBlockValueId: current.id } });
      await tx.blockValueHistory.create({
        data: {
          slideBlockValueId: current.id,
          oldValue: current.value as any,
          newValue: { path: null } as any,
          changedBy: req.user!.userId,
        },
      });
      await tx.slideBlockValue.update({ where: { id: current.id }, data: { value: { path: null } as any } });
    });

    await fs.unlink(path.join(CHART_IMAGE_DIR, oldPath)).catch(() => {});
    res.json({ templateBlockId: block.id, value: { path: null } });
  }
);

export default router;
