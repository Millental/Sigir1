import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const includeFields = { fields: { orderBy: { order: "asc" as const } } };

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

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { name, isShared, fields } = req.body ?? {};
  if (!name || !Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: "Укажите название шаблона и хотя бы одно поле" });
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
  const { name, isShared, fields } = req.body ?? {};
  const templateId = req.params.id;

  const existing = await prisma.template.findUnique({ where: { id: templateId }, include: includeFields });
  if (!existing) return res.status(404).json({ error: "Шаблон не найден" });

  try {
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

    res.json(template);
  } catch (err: any) {
    if (err?.message === "EMPTY_LABEL") {
      return res.status(400).json({ error: "У каждого поля должна быть подпись" });
    }
    if (err?.code === "P2003" || err?.code === "P2014") {
      return res
        .status(409)
        .json({ error: "Нельзя удалить поле — по нему уже есть заполненные значения в слайдах" });
    }
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

export default router;
