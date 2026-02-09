-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "BusinessImage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "ProfileImage" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileImage_pkey" PRIMARY KEY ("id")
);

-- Add vacation mode columns to Business (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Business' AND column_name = 'isOnVacation') THEN
        ALTER TABLE "Business" ADD COLUMN "isOnVacation" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Business' AND column_name = 'vacationMessage') THEN
        ALTER TABLE "Business" ADD COLUMN "vacationMessage" TEXT;
    END IF;
END $$;

-- Add pricing columns to Service (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Service' AND column_name = 'pricingType') THEN
        ALTER TABLE "Service" ADD COLUMN "pricingType" TEXT NOT NULL DEFAULT 'HOURLY';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Service' AND column_name = 'isVariablePrice') THEN
        ALTER TABLE "Service" ADD COLUMN "isVariablePrice" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Remove unused columns from BusinessHours (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BusinessHours' AND column_name = 'createdAt') THEN
        ALTER TABLE "BusinessHours" DROP COLUMN "createdAt";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BusinessHours' AND column_name = 'updatedAt') THEN
        ALTER TABLE "BusinessHours" DROP COLUMN "updatedAt";
    END IF;
END $$;

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "BusinessImage_businessId_idx" ON "BusinessImage"("businessId");
CREATE INDEX IF NOT EXISTS "ProfileImage_profileId_idx" ON "ProfileImage"("profileId");

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'BusinessImage_businessId_fkey') THEN
        ALTER TABLE "BusinessImage" ADD CONSTRAINT "BusinessImage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProfileImage_profileId_fkey') THEN
        ALTER TABLE "ProfileImage" ADD CONSTRAINT "ProfileImage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
