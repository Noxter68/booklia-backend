-- Rename ProfileImage table to PeopleImage
ALTER TABLE "ProfileImage" RENAME TO "PeopleImage";

-- Rename index
ALTER INDEX "ProfileImage_profileId_idx" RENAME TO "PeopleImage_profileId_idx";
