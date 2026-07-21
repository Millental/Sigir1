-- CreateTable
CREATE TABLE "ChartImageAsset" (
    "id" TEXT NOT NULL,
    "slideBlockValueId" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChartImageAsset_slideBlockValueId_key" ON "ChartImageAsset"("slideBlockValueId");

-- AddForeignKey
ALTER TABLE "ChartImageAsset" ADD CONSTRAINT "ChartImageAsset_slideBlockValueId_fkey" FOREIGN KEY ("slideBlockValueId") REFERENCES "SlideBlockValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
