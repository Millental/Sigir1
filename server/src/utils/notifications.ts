import { Prisma } from "@prisma/client";

// Порог «дедлайн приближается» — см. REQUIREMENTS.md, Этап 8. Кандидат на вынос в настраиваемый
// параметр в одном из будущих этапов; этим этапом настраиваемость не вводится.
export const DEADLINE_APPROACHING_HOURS = 24;

export async function notifyCycleSlideOwners(
  tx: Prisma.TransactionClient,
  weeklyCycleId: string,
  type: "CYCLE_ASSEMBLED" | "CYCLE_ARCHIVED",
  message: string
): Promise<void> {
  const owners = await tx.slide.findMany({
    where: { weeklyCycleId },
    select: { ownerId: true },
    distinct: ["ownerId"],
  });
  if (owners.length === 0) return;
  await tx.notification.createMany({
    data: owners.map((o) => ({ recipientId: o.ownerId, type, weeklyCycleId, message })),
  });
}
