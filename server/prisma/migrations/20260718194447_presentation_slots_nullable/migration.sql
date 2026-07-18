/*
  Warnings:

  - The primary key for the `PresentationSlide` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `id` was added to the `PresentationSlide` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "PresentationSlide" DROP CONSTRAINT "PresentationSlide_slideId_fkey";

-- AlterTable
ALTER TABLE "PresentationSlide" DROP CONSTRAINT "PresentationSlide_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "placeholderLabel" TEXT,
ALTER COLUMN "slideId" DROP NOT NULL,
ADD CONSTRAINT "PresentationSlide_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "PresentationSlide" ADD CONSTRAINT "PresentationSlide_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE SET NULL ON UPDATE CASCADE;
