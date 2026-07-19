import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const includeFields = {
  fields: { orderBy: { order: "asc" as const } },
  blocks: { orderBy: { order: "asc" as const } },
  _count: { select: { slides: true } },
};

const LAYOUT_KINDS = ["QUADRANT", "FINANCIAL_CHART", "SIMPLE_COLUMN"] as const;
const BLOCK_TYPES = ["METRIC_TILE", "RICH_TEXT_SECTION", "TABLE", "FOOTER_STATS"] as const;
type LayoutKind = (typeof LAYOUT_KINDS)[number];
type BlockType = (typeof BLOCK_TYPES)[number];

router.get("/", async (_req, res) => {
  const templates = await prisma.template.findMany({
    include: includeFields,
    orderBy: { name: "asc" },
  });
  res.json(templates);
});

router.get("/:id", async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    include: includeFields,
  });
  if (!template) return res.status(404).json({ error: "Шаблон не найден" });
  res.json(template);
});

interface FieldInput {
  id?: string;
  label: string;
  isRequired?: boolean;
  order?: number;
}

interface BlockInput {
  id?: string;
  blockType: string;
  label: string;
  isRequired?: boolean;
  order?: number;
  config?: { columns?: string[] } | null;
}

function validateBlocks(blocks: unknown): string | null {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return "Добавьте хотя бы один блок";
  }
  for (const b of blocks as BlockInput[]) {
    if (!b.label || !b.label.trim()) return "У каждого блока должна быть подпись";
    if (!BLOCK_TYPES.includes(b.blockType as BlockType)) return "Неизвестный тип блока";
    if (b.blockType === "TABLE") {
      const columns = b.config?.columns;
      if (!Array.isArray(columns) || columns.length === 0 || columns.some((c) => typeof c !== "string" || !c.trim())) {
        return "Для блока «Таблица» укажите хотя бы одну непустую колонку";
      }
    }
  }
  return null;
}

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { name, isShared, fields, layoutKind, blocks } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Укажите название шаблона" });
  }

  if (layoutKind !== undefined) {
    if (!LAYOUT_KINDS.includes(layoutKind as LayoutKind)) {
      return res.status(400).json({ error: "Неизвестный layoutKind" });
    }
    const blocksError = validateBlocks(blocks);
    if (blocksError) return res.status(400).json({ error: blocksError });

    const template = await prisma.template.create({
      data: {
        name,
        isShared: Boolean(isShared),
        createdBy: req.user!.userId,
        layoutKind: layoutKind as LayoutKind,
        blocks: {
          create: (blocks as BlockInput[]).map((b, i) => ({
            blockType: b.blockType as BlockType,
            label: b.label,
            isRequired: Boolean(b.isRequired),
            order: b.order ?? i,
            config: b.blockType === "TABLE" ? { columns: b.config?.columns } : undefined,
          })),
        },
      },
      include: includeFields,
    });

    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "TEMPLATE_CREATE", targetType: "Template", targetId: template.id },
    });

    return res.status(201).json(template);
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: "Укажите хотя бы одно поле" });
  }
  if ((fields as FieldInput[]).some((f) => !f.label)) {
    return res.status(400).json({ error: "У каждого поля должна быть подпись" });
  }

  const template = await prisma.template.create({
    data: {
      name,
      isShared: Boolean(isShared),
      createdBy: req.user!.userId,
      fields: {
        create: (fields as FieldInput[]).map((f, i) => ({
          label: f.label,
          isRequired: Boolean(f.isRequired),
          order: f.order ?? i,
        })),
      },
    },
    include: includeFields,
  });

  await prisma.auditLogEntry.create({
    data: { userId: req.user!.userId, action: "TEMPLATE_CREATE", targetType: "Template", targetId: template.id },
  });

  res.status(201).json(template);
});

router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const { name, isShared, fields, blocks } = req.body ?? {};
  const templateId = req.params.id;

  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    include: { fields: true, blocks: true },
  });
  if (!existing) return res.status(404).json({ error: "Шаблон не найден" });

  try {
    if (existing.layoutKind === null) {
      const template = await prisma.$transaction(async (tx) => {
        await tx.template.update({
          where: { id: templateId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(isShared !== undefined ? { isShared: Boolean(isShared) } : {}),
          },
        });

        if (Array.isArray(fields)) {
          const incoming = fields as FieldInput[];
          const keepIds = new Set(incoming.filter((f) => f.id).map((f) => f.id));
          const toDelete = existing.fields.filter((f) => !keepIds.has(f.id));

          for (const f of toDelete) {
            await tx.templateField.delete({ where: { id: f.id } });
          }
          for (const [i, f] of incoming.entries()) {
            if (!f.label) throw new Error("EMPTY_LABEL");
            if (f.id) {
              await tx.templateField.update({
                where: { id: f.id },
                data: { label: f.label, isRequired: Boolean(f.isRequired), order: f.order ?? i },
              });
            } else {
              await tx.templateField.create({
                data: {
                  templateId,
                  label: f.label,
                  isRequired: Boolean(f.isRequired),
                  order: f.order ?? i,
                },
              });
            }
          }
        }

        return tx.template.findUniqueOrThrow({ where: { id: templateId }, include: includeFields });
      });

      await prisma.auditLogEntry.create({
        data: { userId: req.user!.userId, action: "TEMPLATE_UPDATE", targetType: "Template", targetId: templateId },
      });

      return res.json(template);
    }

    // Блочный шаблон (existing.layoutKind !== null): layoutKind неизменен после создания.
    if (Array.isArray(blocks)) {
      const slideCount = await prisma.slide.count({ where: { templateId } });
      if (slideCount > 0) {
        return res.status(409).json({ error: "Нельзя менять состав блоков — по шаблону уже есть слайды" });
      }
      const blocksError = validateBlocks(blocks);
      if (blocksError) return res.status(400).json({ error: blocksError });
    }

    const template = await prisma.$transaction(async (tx) => {
      await tx.template.update({
        where: { id: templateId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(isShared !== undefined ? { isShared: Boolean(isShared) } : {}),
        },
      });

      if (Array.isArray(blocks)) {
        const incoming = blocks as BlockInput[];
        const keepIds = new Set(incoming.filter((b) => b.id).map((b) => b.id));
        const toDelete = existing.blocks.filter((b) => !keepIds.has(b.id));

        for (const b of toDelete) {
          await tx.templateBlock.delete({ where: { id: b.id } });
        }
        for (const [i, b] of incoming.entries()) {
          const config = b.blockType === "TABLE" ? { columns: b.config?.columns } : undefined;
          if (b.id) {
            await tx.templateBlock.update({
              where: { id: b.id },
              data: {
                blockType: b.blockType as BlockType,
                label: b.label,
                isRequired: Boolean(b.isRequired),
                order: b.order ?? i,
                config,
              },
            });
          } else {
            await tx.templateBlock.create({
              data: {
                templateId,
                blockType: b.blockType as BlockType,
                label: b.label,
                isRequired: Boolean(b.isRequired),
                order: b.order ?? i,
                config,
              },
            });
          }
        }
      }

      return tx.template.findUniqueOrThrow({ where: { id: templateId }, include: includeFields });
    });

    await prisma.auditLogEntry.create({
      data: { userId: req.user!.userId, action: "TEMPLATE_UPDATE", targetType: "Template", targetId: templateId },
    });

    res.json(template);
  } catch (err: any) {
    if (err?.message === "EMPTY_LABEL") {
      return res.status(400).json({ error: "У каждого поля должна быть подпись" });
    }
    if (err?.code === "P2003" || err?.code === "P2014") {
      return res
        .status(409)
        .json({ error: "Нельзя удалить поле/блок — по нему уже есть заполненные значения в слайдах" });
    }
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

export default router;
