-- AlterEnum: Add NO_SHOW to BookingStatus
ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

-- CreateEnum: CalendarEntryKind
CREATE TYPE "CalendarEntryKind" AS ENUM ('APPOINTMENT', 'BLOCK');

-- CreateEnum: BlockReason
CREATE TYPE "BlockReason" AS ENUM ('BREAK', 'UNAVAILABLE', 'PERSONAL', 'CLOSED');

-- AlterTable: Add calendar fields to Booking
ALTER TABLE "Booking" ADD COLUMN "kind" "CalendarEntryKind" NOT NULL DEFAULT 'APPOINTMENT';
ALTER TABLE "Booking" ADD COLUMN "blockReason" "BlockReason";

-- AlterTable: Make businessServiceId nullable for BLOCK entries
ALTER TABLE "Booking" ALTER COLUMN "businessServiceId" DROP NOT NULL;

-- CreateIndex: Composite index for calendar queries
CREATE INDEX "Booking_employeeId_scheduledAt_idx" ON "Booking"("employeeId", "scheduledAt");
