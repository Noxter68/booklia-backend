/*
  Warnings:

  - You are about to drop the column `endTime` on the `EmployeeException` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `EmployeeException` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EmployeeAvailability_employeeId_dayOfWeek_key";

-- AlterTable
ALTER TABLE "EmployeeException" DROP COLUMN "endTime",
DROP COLUMN "startTime";

-- CreateTable
CREATE TABLE "EmployeeExceptionSlot" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "EmployeeExceptionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeExceptionSlot_exceptionId_idx" ON "EmployeeExceptionSlot"("exceptionId");

-- CreateIndex
CREATE INDEX "EmployeeAvailability_employeeId_dayOfWeek_idx" ON "EmployeeAvailability"("employeeId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "EmployeeExceptionSlot" ADD CONSTRAINT "EmployeeExceptionSlot_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "EmployeeException"("id") ON DELETE CASCADE ON UPDATE CASCADE;
