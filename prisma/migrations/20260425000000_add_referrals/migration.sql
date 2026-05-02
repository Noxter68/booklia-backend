-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "freeMonthsEarned" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "instagram" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "rewardGrantedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_businessId_createdAt_idx" ON "Referral"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_status_createdAt_idx" ON "Referral"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
