-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('AUTOENTREPRENEUR_BIC_SERVICE', 'AUTOENTREPRENEUR_BIC_VENTE', 'AUTOENTREPRENEUR_BNC', 'EI', 'EURL', 'SASU', 'SARL', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('URSSAF', 'RENT', 'MATERIAL', 'SUPPLIER_ORDER', 'INSURANCE', 'SOFTWARE', 'MARKETING', 'OTHER');

-- AlterTable
ALTER TABLE "BusinessBillingSettings" ADD COLUMN     "acreActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acreEndDate" TIMESTAMP(3),
ADD COLUMN     "incomeTaxRate" DOUBLE PRECISION,
ADD COLUMN     "legalForm" "LegalForm",
ADD COLUMN     "urssafRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_businessId_date_idx" ON "Expense"("businessId", "date");

-- CreateIndex
CREATE INDEX "Expense_businessId_category_idx" ON "Expense"("businessId", "category");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
