-- DropForeignKey
ALTER TABLE "BusinessServiceOption" DROP CONSTRAINT "BusinessServiceOption_businessServiceId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessServiceOption" DROP CONSTRAINT "BusinessServiceOption_serviceOptionId_fkey";

-- DropTable
DROP TABLE "BusinessServiceOption";

