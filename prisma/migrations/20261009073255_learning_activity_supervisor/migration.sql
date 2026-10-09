/*
  Warnings:

  - Added the required column `supervisorId` to the `LearningActivity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LearningActivity" ADD COLUMN     "supervisorId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "LearningActivity_supervisorId_idx" ON "LearningActivity"("supervisorId");

-- AddForeignKey
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
