-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "BusinessService" ADD COLUMN "businessCategoryId" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "reply" TEXT;
ALTER TABLE "Review" ADD COLUMN "repliedAt" TIMESTAMP(3);

-- AlterTable (already done by previous migration, but needed for drift resolution)
-- Note: ratingAvg10 -> ratingAvg5 was handled in 20260205_rename_rating_avg

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_businessId_dayOfWeek_key" ON "BusinessHours"("businessId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "BusinessCategory_businessId_idx" ON "BusinessCategory"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCategory_businessId_name_key" ON "BusinessCategory"("businessId", "name");

-- CreateIndex
CREATE INDEX "BusinessService_businessCategoryId_idx" ON "BusinessService"("businessCategoryId");

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCategory" ADD CONSTRAINT "BusinessCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessService" ADD CONSTRAINT "BusinessService_businessCategoryId_fkey" FOREIGN KEY ("businessCategoryId") REFERENCES "BusinessCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
