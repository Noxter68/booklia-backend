-- CreateEnum
CREATE TYPE "ServicePriceMode" AS ENUM ('FIXED', 'QUOTE', 'FREE');

-- AlterTable
ALTER TABLE "BusinessService" ADD COLUMN     "priceMode" "ServicePriceMode" NOT NULL DEFAULT 'FIXED';
