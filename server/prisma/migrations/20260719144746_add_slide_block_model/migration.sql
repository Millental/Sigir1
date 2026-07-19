-- CreateEnum
CREATE TYPE "LayoutKind" AS ENUM ('QUADRANT', 'FINANCIAL_CHART', 'SIMPLE_COLUMN');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('METRIC_TILE', 'RICH_TEXT_SECTION', 'TABLE', 'FOOTER_STATS');

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "layoutKind" "LayoutKind";

-- CreateTable
CREATE TABLE "TemplateBlock" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "blockType" "BlockType" NOT NULL,
    "label" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "TemplateBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideBlockValue" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "templateBlockId" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SlideBlockValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockValueHistory" (
    "id" TEXT NOT NULL,
    "slideBlockValueId" TEXT NOT NULL,
    "oldValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlideBlockValue_slideId_templateBlockId_key" ON "SlideBlockValue"("slideId", "templateBlockId");

-- AddForeignKey
ALTER TABLE "TemplateBlock" ADD CONSTRAINT "TemplateBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideBlockValue" ADD CONSTRAINT "SlideBlockValue_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideBlockValue" ADD CONSTRAINT "SlideBlockValue_templateBlockId_fkey" FOREIGN KEY ("templateBlockId") REFERENCES "TemplateBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockValueHistory" ADD CONSTRAINT "BlockValueHistory_slideBlockValueId_fkey" FOREIGN KEY ("slideBlockValueId") REFERENCES "SlideBlockValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
