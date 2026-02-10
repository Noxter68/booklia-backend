-- Migration to change from price range to single fixed price

-- Step 1: Add the new priceCents column
ALTER TABLE "Service" ADD COLUMN "priceCents" INTEGER;

-- Step 2: Migrate data from priceMinCents to priceCents
UPDATE "Service" SET "priceCents" = "priceMinCents" WHERE "priceMinCents" IS NOT NULL;

-- Step 3: Drop the old columns
ALTER TABLE "Service" DROP COLUMN IF EXISTS "priceMinCents";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "priceMaxCents";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "isVariablePrice";
