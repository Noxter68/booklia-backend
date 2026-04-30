-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "appliedTierWeeks" INTEGER;

-- CreateTable
CREATE TABLE "ServicePricingTier" (
    "id" TEXT NOT NULL,
    "businessServiceId" TEXT NOT NULL,
    "thresholdWeeks" INTEGER NOT NULL,
    "surchargeCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePricingTier_businessServiceId_idx" ON "ServicePricingTier"("businessServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePricingTier_businessServiceId_thresholdWeeks_key" ON "ServicePricingTier"("businessServiceId", "thresholdWeeks");

-- CreateIndex
CREATE INDEX "Booking_requesterId_businessServiceId_status_scheduledAt_idx" ON "Booking"("requesterId", "businessServiceId", "status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "ServicePricingTier" ADD CONSTRAINT "ServicePricingTier_businessServiceId_fkey" FOREIGN KEY ("businessServiceId") REFERENCES "BusinessService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
