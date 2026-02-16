-- Add isAdmin flag to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Add address and geolocation to Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
