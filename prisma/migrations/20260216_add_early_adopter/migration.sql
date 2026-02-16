-- Add isEarlyAdopter flag to Business
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "isEarlyAdopter" BOOLEAN NOT NULL DEFAULT false;
