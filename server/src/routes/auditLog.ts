import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.lastIndexOf("|");
    if (sep < 0) return null;
    const createdAt = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

router.get("/", async (req, res) => {
  const { action, targetType, userId, from, to, cursor } = req.query;

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;

  const where: Prisma.AuditLogEntryWhereInput = {};
  if (typeof action === "string" && action) where.action = action;
  if (typeof targetType === "string" && targetType) where.targetType = targetType;
  if (typeof userId === "string" && userId) where.userId = userId;

  if (typeof from === "string" && from) {
    const d = new Date(from);
    if (isNaN(d.getTime())) return res.status(400).json({ error: "Некорректная дата «с»" });
    where.createdAt = { ...(where.createdAt as object | undefined), gte: d };
  }
  if (typeof to === "string" && to) {
    const d = new Date(to);
    if (isNaN(d.getTime())) return res.status(400).json({ error: "Некорректная дата «по»" });
    where.createdAt = { ...(where.createdAt as object | undefined), lte: d };
  }

  let finalWhere: Prisma.AuditLogEntryWhereInput = where;
  if (typeof cursor === "string" && cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return res.status(400).json({ error: "Некорректный курсор" });
    finalWhere = {
      AND: [
        where,
        {
          OR: [{ createdAt: { lt: decoded.createdAt } }, { createdAt: decoded.createdAt, id: { lt: decoded.id } }],
        },
      ],
    };
  }

  const rows = await prisma.auditLogEntry.findMany({
    where: finalWhere,
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  res.json({
    items: page.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
      user: r.user ? { id: r.user.id, fullName: r.user.fullName } : null,
    })),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    hasMore,
  });
});

export default router;
