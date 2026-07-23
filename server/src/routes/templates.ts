import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { stableStringify } from "../utils/stableStringify";

const router = Router();

router.use(requireAuth);

const includeFields = {
  fields: { orderBy: { order: "asc" as const } },
  blocks: { orderBy: { order: "asc" as const } },
  _count: { select: { slides: true } },
};

const LAYOUT_KINDS = ["QUADRANT", "FINANCIAL_CHART", "SIMPLE_COLUMN"] as const;
const BLOCK_TYPES = ["METRIC_TILE", "RICH_TEXT_SECTION", "TABLE", "FOOTER_STATS", "CHART_IMAGE"] as const;
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

router.get("/:id/versions", requireRole("ADMIN"), async (req, res) => {
  const versions = await prisma.templateVersion.findMany({
    where: { templateId: req.params.id },
    orderBy: { versionNumber: "desc" },
  });
  const changedByIds = [...new Set(versions.map((v) => v.changedBy))];
  const users = await prisma.user.findMany({ where: { id: { in: changedByIds } }, select: { id: true, fullName: true } });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  res.json(
    versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      name: v.name,
      isShared: v.isShared,
      layoutKind: v.layoutKind,
      fieldsSnapshot: v.fieldsSnapshot,
      blocksSnapshot: v.blocksSnapshot,
      changedBy: { id: v.changedBy, fullName: nameById.get(v.changedBy) ?? "?" },
      createdAt: v.createdAt,
    }))
  );
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

function fieldsSnapshotOf(fields: { id: string; label: string; isRequired: boolean; order: number }[]) {
  return [...fields]
    .sort((a, b) => a.order - b.order)
    .map((f) => ({ id: f.id, label: f.label, isRequired: f.isRequired, order: f.order }));
}

function blocksSnapshotOf(
  blocks: { id: string; blockType: string; label: string; isRequired: boolean; order: number; config: unknown }[]
) {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((b) => ({ id: b.id, blockType: b.blockType, label: b.label, isRequired: b.isRequired, order: b.order, config: b.config }));
}

// Сравнение "до/после" для пропуска бесполезных версий при no-op сохранении (тот же принцип,
// что stableStringify уже применяет в slides.ts для истории значений) — сортировка внутри
// fieldsSnapshotOf/blocksSnapshotOf обязательна, потому что `existing` читается без orderBy,
// а includeFields (использованный для итогового состояния) его применяет.
function templateSnapshotKey(t: {
  name: string;
  isShared: boolean;
  layoutKind: string | null;
  fields: { id: string; label: string; isRequired: boolean; order: number }[];
  blocks: { id: string; blockType: string; label: string; isRequired: boolean; order: number; config: unknown }[];
}): string {
  return stableStringify({
    name: t.name,
    isShared: t.isShared,
    fieldsSnapshot: t.layoutKind === null ? fieldsSnapshotOf(t.fields) : null,
    blocksSnapshot: t.layoutKind !== null ? blocksSnapshotOf(t.blocks) : null,
  });
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

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
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

      await tx.templateVersion.create({
        data: {
          templateId: created.id,
          versionNumber: 1,
          name: created.name,
          isShared: created.isShared,
          layoutKind: created.layoutKind,
          blocksSnapshot: blocksSnapshotOf(created.blocks) as Prisma.InputJsonValue,
          changedBy: req.user!.userId,
        },
      });

      return created;
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

  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.template.create({
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

    await tx.templateVersion.create({
      data: {
        templateId: created.id,
        versionNumber: 1,
        name: created.name,
        isShared: created.isShared,
        layoutKind: created.layoutKind,
        fieldsSnapshot: fieldsSnapshotOf(created.fields),
        changedBy: req.user!.userId,
      },
    });

    return created;
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

        const finalTemplate = await tx.template.findUniqueOrThrow({ where: { id: templateId }, include: includeFields });
        if (templateSnapshotKey(existing) !== templateSnapshotKey(finalTemplate)) {
          const bumped = await tx.template.update({
            where: { id: templateId },
            data: { version: { increment: 1 } },
          });
          await tx.templateVersion.create({
            data: {
              templateId,
              versionNumber: bumped.version,
              name: finalTemplate.name,
              isShared: finalTemplate.isShared,
              layoutKind: finalTemplate.layoutKind,
              fieldsSnapshot: fieldsSnapshotOf(finalTemplate.fields),
              changedBy: req.user!.userId,
            },
          });
          return { ...finalTemplate, version: bumped.version };
        }
        return finalTemplate;
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

      const finalTemplate = await tx.template.findUniqueOrThrow({ where: { id: templateId }, include: includeFields });
      if (templateSnapshotKey(existing) !== templateSnapshotKey(finalTemplate)) {
        const bumped = await tx.template.update({
          where: { id: templateId },
          data: { version: { increment: 1 } },
        });
        await tx.templateVersion.create({
          data: {
            templateId,
            versionNumber: bumped.version,
            name: finalTemplate.name,
            isShared: finalTemplate.isShared,
            layoutKind: finalTemplate.layoutKind,
            blocksSnapshot: blocksSnapshotOf(finalTemplate.blocks) as Prisma.InputJsonValue,
            changedBy: req.user!.userId,
          },
        });
        return { ...finalTemplate, version: bumped.version };
      }
      return finalTemplate;
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
