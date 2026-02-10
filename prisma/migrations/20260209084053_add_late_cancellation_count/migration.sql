-- AlterTable
ALTER TABLE "PeopleImage" RENAME CONSTRAINT "ProfileImage_pkey" TO "PeopleImage_pkey";

-- AlterTable
ALTER TABLE "UserReputation" ADD COLUMN     "lateCancellationCount" INTEGER NOT NULL DEFAULT 0;

-- RenameForeignKey
ALTER TABLE "PeopleImage" RENAME CONSTRAINT "ProfileImage_profileId_fkey" TO "PeopleImage_profileId_fkey";
