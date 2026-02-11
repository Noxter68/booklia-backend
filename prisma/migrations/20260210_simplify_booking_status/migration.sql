-- Migration: Simplify BookingStatus enum
-- Remove: IN_PROGRESS, DISPUTED
-- Add: REJECTED

-- First, update any existing IN_PROGRESS bookings to ACCEPTED (shouldn't be many)
UPDATE "Booking" SET "status" = 'ACCEPTED' WHERE "status" = 'IN_PROGRESS';

-- Update any DISPUTED bookings to CANCELED
UPDATE "Booking" SET "status" = 'CANCELED' WHERE "status" = 'DISPUTED';

-- Now alter the enum type
-- PostgreSQL doesn't allow removing values from enum, so we need to recreate it

-- Remove default first
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;

-- Create new enum type
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELED');

-- Update the column to use text temporarily
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE TEXT;

-- Drop old enum
DROP TYPE "BookingStatus";

-- Rename new enum to original name
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";

-- Update column back to enum
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus" USING "status"::"BookingStatus";

-- Set default
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"BookingStatus";
