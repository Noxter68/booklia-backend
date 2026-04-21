import { IsISO8601, IsOptional, IsString, IsEnum } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateCalendarEntryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  updatedAt?: string;
}
