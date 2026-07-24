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
  assignedUsers: { include: { user: { select: { id: true, fullName: true } } } },
  assignedDepartments: { include: { department: { select: { id: true, name: true } } } },
  _count: { select: { slides: true } },
};

// Видимость шаблонов для SPEAKER: общий (isShared), назначен лично, назначен его отделу,
// либо вообще без единого назначения (трактуется как общий — сохраняет фактическое поведение
// до введения назначений, без миграции существующих данных).
async function speakerVisibilityWhere(userId: string): Promise<Prisma.TemplateWhereInput> {
  const caller = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
  const orConditions: Prisma.TemplateWhereInput[] = [
    { isShared: true },
    { assignedUsers: { some: { userId } } },
    { AND: [{ assignedUsers: { none: {} } }, { assignedDepartments: { none: {} } }] },
  ];
  if (caller?.departmentId) {
    orConditions.push({ assignedDepartments: { some: { departmentId: caller.departmentId } } });
  }
  return { OR: orConditions };
}

async function validateAssignmentIds(assignedUserIds: unknown, assignedDepartmentIds: unknown): Promise<string | null> {
  if (assignedUserIds !== undefined) {
    if (!Array.isArray(assignedUserIds) || assignedUserIds.some((id) => typeof id !== "string")) {
      return "assignedUserIds должен быть массивом идентификаторов";
    }
    const uniqueIds = new Set(assignedUserIds as string[]);
    const count = await prisma.user.count({ where: { id: { in: [...uniqueIds] } } });
    if (count !== uniqueIds.size) {
      return "Один или несколько выбранных пользователей не найдены";
    }
  }
  if (assignedDepartmentIds !== undefined) {
    if (!Array.isArray(assignedDepartmentIds) || assignedDepartmentIds.some((id) => typeof id !== "string")) {
      return "assignedDepartmentIds должен быть массивом идентификаторов";
    }
    const uniqueIds = new Set(assignedDepartmentIds as string[]);
    const count = await prisma.department.count({ where: { id: { in: [...uniqueIds] } } });
    if (count !== uniqueIds.size) {
      return "Один или несколько выбранных отделов не найдены";
    }
  }
  return null;
}

// Назначения шаблона не имеют входящих ссылок (в отличие от TemplateField/TemplateBlock,
// на которые ссылаются SlideFieldValue/SlideBlockValue) — поэтому при сохранении их проще и
// безопаснее полностью перезаписывать, а не переносить по id.
async function replaceAssignments(
  tx: Prisma.TransactionClient,
  templateId: string,
  assignedUserIds: unknown,
  assignedDepartmentIds: unknown
) {
  if (Array.isArray(assignedUserIds)) {
    const uniqueUserIds = [...new Set(assignedUserIds as string[])];
    await tx.templateUserAssignment.deleteMany({ where: { templateId } });
    if (uniqueUserIds.length > 0) {
      await tx.templateUserAssignment.createMany({
        data: uniqueUserIds.map((userId) => ({ templateId, userId })),
      });
    }
  }
  if (Array.isArray(assignedDepartmentIds)) {
    const uniqueDepartmentIds = [...new Set(assignedDepartmentIds as string[])];
    await tx.templateDepartmentAssignment.deleteMany({ where: { templateId } });
    if (uniqueDepartmentIds.length > 0) {
      await tx.templateDepartmentAssignment.createMany({
        data: uniqueDepartmentIds.map((departmentId) => ({ templateId, departmentId })),
      });
    }
  }
}

const LAYOUT_KINDS = ["QUADRANT", "FINANCIAL_CHART", "SIMPLE_COLUMN"] as const;
const BLOCK_TYPES = ["METRIC_TILE", "RICH_TEXT_SECTION", "TABLE", "FOOTER_STATS", "CHART_IMAGE"] as const;
type LayoutKind = (typeof LAYOUT_KINDS)[number];
type BlockType = (typeof BLOCK_TYPES)[number];

router.get("/", async (req, res) => {
  if (req.user!.role === "ADMIN") {
    const templates = await prisma.template.findMany({ include: includeFields, orderBy: { name: "asc" } });
    return res.json(templates);
  }
  const where = await speakerVisibilityWhere(req.user!.userId);
  const templates = await prisma.template.findMany({ where, include: includeFields, orderBy: { name: "asc" } });
  res.json(templates);
});

router.get("/:id", async (req, res) => {
  if (req.user!.role === "ADMIN") {
    const template = await prisma.template.findUnique({ where: { id: req.params.id }, include: includeFields });
    if (!template) return res.status(404).json({ error: "Шаблон не найден" });
    return res.json(template);
  }
  const where = await speakerVisibilityWhere(req.user!.userId);
  const template = await prisma.template.findFirst({ where: { ...where, id: req.params.id }, include: includeFields });
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
  const { name, isShared, fields, layoutKind, blocks, assignedUserIds, assignedDepartmentIds } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Укажите название шаблона" });
  }

  const assignmentError = await validateAssignmentIds(assignedUserIds, assignedDepartmentIds);
  if (assignmentError) {
    return res.status(400).json({ error: assignmentError });
  }
  // Дедуплицируем: assignedUserIds/assignedDepartmentIds образуют @@unique([templateId, ...Id]),
  // повторяющийся id во входном массиве иначе упадёт на P2002 внутри транзакции без ответа клиенту.
  const uniqueAssignedUserIds = Array.isArray(assignedUserIds) ? [...new Set(assignedUserIds as string[])] : assignedUserIds;
  const uniqueAssignedDepartmentIds = Array.isArray(assignedDepartmentIds)
    ? [...new Set(assignedDepartmentIds as string[])]
    : assignedDepartmentIds;

  if (layoutKind !== undefined) {
    if (!LAYOUT_KINDS.includes(layoutKind as LayoutKind)) {
      return res.status(400).json({ error: "Неизвестный layoutKind" });
    }
    const blocksError = validateBlocks(blocks);
    if (blocksError) return res.status(400).json({ error: blocksError });

    try {
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
            ...(Array.isArray(uniqueAssignedUserIds)
              ? { assignedUsers: { create: uniqueAssignedUserIds.map((userId) => ({ userId })) } }
              : {}),
            ...(Array.isArray(uniqueAssignedDepartmentIds)
              ? { assignedDepartments: { create: uniqueAssignedDepartmentIds.map((departmentId) => ({ departmentId })) } }
              : {}),
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
    } catch (err: any) {
      if (err?.code === "P2002") {
        return res.status(400).json({ error: "Назначение содержит повторяющиеся идентификаторы" });
      }
      console.error(err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: "Укажите хотя бы одно поле" });
  }
  if ((fields as FieldInput[]).some((f) => !f.label)) {
    return res.status(400).json({ error: "У каждого поля должна быть подпись" });
  }

  try {
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
          ...(Array.isArray(uniqueAssignedUserIds)
            ? { assignedUsers: { create: uniqueAssignedUserIds.map((userId) => ({ userId })) } }
            : {}),
          ...(Array.isArray(uniqueAssignedDepartmentIds)
            ? { assignedDepartments: { create: uniqueAssignedDepartmentIds.map((departmentId) => ({ departmentId })) } }
            : {}),
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
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(400).json({ error: "Назначение содержит повторяющиеся идентификаторы" });
    }
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const { name, isShared, fields, blocks, assignedUserIds, assignedDepartmentIds } = req.body ?? {};
  const templateId = req.params.id;

  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    include: { fields: true, blocks: true },
  });
  if (!existing) return res.status(404).json({ error: "Шаблон не найден" });

  const assignmentError = await validateAssignmentIds(assignedUserIds, assignedDepartmentIds);
  if (assignmentError) {
    return res.status(400).json({ error: assignmentError });
  }

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

        await replaceAssignments(tx, templateId, assignedUserIds, assignedDepartmentIds);

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

      await replaceAssignments(tx, templateId, assignedUserIds, assignedDepartmentIds);

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
    if (err?.code === "P2002") {
      return res.status(400).json({ error: "Назначение содержит повторяющиеся идентификаторы" });
    }
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

export default router;
