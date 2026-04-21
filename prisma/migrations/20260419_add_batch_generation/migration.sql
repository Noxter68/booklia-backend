-- CreateEnum
CREATE TYPE "public"."BatchGenerationStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."BatchGeneration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "public"."BatchGenerationStatus" NOT NULL DEFAULT 'COMPLETED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "totalHTCents" INTEGER NOT NULL DEFAULT 0,
    "totalVATCents" INTEGER NOT NULL DEFAULT 0,
    "totalTTCCents" INTEGER NOT NULL DEFAULT 0,
    "invoiceIds" TEXT[],
    "errors" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchGeneration_businessId_createdAt_idx" ON "public"."BatchGeneration"("businessId" ASC, "createdAt" ASC);

-- AddForeignKey
ALTER TABLE "public"."BatchGeneration" ADD CONSTRAINT "BatchGeneration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BatchGeneration" ADD CONSTRAINT "BatchGeneration_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

