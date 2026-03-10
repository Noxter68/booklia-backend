import { IsString, IsInt, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { ReviewType } from '@prisma/client';

export class CreateReviewDto {
  @IsString()
  bookingId: string;

  @IsEnum(ReviewType)
  type: ReviewType;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
