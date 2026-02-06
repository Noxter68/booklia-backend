-- Rename ratingAvg10 to ratingAvg5 in UserReputation table
ALTER TABLE "UserReputation" RENAME COLUMN "ratingAvg10" TO "ratingAvg5";

-- Update existing values: convert 0-10 scale to 0-5 scale
UPDATE "UserReputation" SET "ratingAvg5" = "ratingAvg5" / 2 WHERE "ratingAvg5" > 0;

-- Update existing review scores: convert 0-10 scale to 1-5 scale
UPDATE "Review" SET "score" = GREATEST(1, CEIL("score" / 2.0)) WHERE "score" > 0;
