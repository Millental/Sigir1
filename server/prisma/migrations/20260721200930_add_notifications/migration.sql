-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CYCLE_ASSEMBLED', 'CYCLE_ARCHIVED');

-- AlterTable
ALTER TABLE "WeeklyCycle" ADD COLUMN     "deadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "weeklyCycleId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientId_hiddenAt_idx" ON "Notification"("recipientId", "hiddenAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_weeklyCycleId_fkey" FOREIGN KEY ("weeklyCycleId") REFERENCES "WeeklyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
