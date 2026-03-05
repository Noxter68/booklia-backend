import { IsString, IsISO8601, IsOptional, IsEnum } from 'class-validator';
import { BlockReason } from '@prisma/client';

export class CreateBlockDto {
  @IsString()
  employeeId: string;

  @IsISO8601()
  startAt: string;

  @IsISO8601()
  endAt: string;

  @IsOptional()
  @IsEnum(BlockReason)
  blockReason?: BlockReason;

  @IsOptional()
  @IsString()
  notes?: string;
}
