-- Migration: Simplify UserReputation to use ELO system
-- Remove: xp, level, trustScore
-- Add: elo (default 1000), completedBookings (default 0)

-- Add new columns first
ALTER TABLE "UserReputation" ADD COLUMN "elo" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "UserReputation" ADD COLUMN "completedBookings" INTEGER NOT NULL DEFAULT 0;

-- Migrate existing data: convert old trustScore to ELO (trustScore was 0-100, ELO is 0-2000)
-- Formula: elo = 1000 + (trustScore - 50) * 10, clamped to 0-2000
UPDATE "UserReputation"
SET "elo" = GREATEST(0, LEAST(2000, 1000 + ("trustScore" - 50) * 10))
WHERE "trustScore" > 0;

-- Drop old columns
ALTER TABLE "UserReputation" DROP COLUMN "xp";
ALTER TABLE "UserReputation" DROP COLUMN "level";
ALTER TABLE "UserReputation" DROP COLUMN "trustScore";
