import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsArray,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { ServiceKind, Urgency, Recurrence, ServiceStatus } from '@prisma/client';

export class CreateServiceDto {
  @IsEnum(ServiceKind)
  kind: ServiceKind;

  @IsString()
  @MaxLength(100)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  // Location
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsString()
  pricingType?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsEnum(Recurrence)
  recurrence?: Recurrence;

  @IsOptional()
  @IsInt()
  @Min(1)
  sessionsCount?: number;

  // Duration
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  // Availability
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableDays?: string[];

  @IsOptional()
  @IsString()
  availableFromTime?: string;

  @IsOptional()
  @IsString()
  availableToTime?: string;

  @IsOptional()
  @IsDateString()
  availableFromDate?: string;

  @IsOptional()
  @IsDateString()
  availableToDate?: string;

  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}
