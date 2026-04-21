import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEmail,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityDto {
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  startTime: string; // "09:00"

  @IsString()
  endTime: string; // "18:00"
}

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  role?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availabilities?: AvailabilityDto[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  serviceIds?: string[];
}

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  role?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availabilities?: AvailabilityDto[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  serviceIds?: string[];
}

export class GetAvailableSlotsDto {
  @IsString()
  employeeId: string;

  @IsString()
  businessServiceId: string;

  @IsString()
  date: string; // "2024-01-15"
}

// ============================================
// EMPLOYEE EXCEPTIONS (closures / special hours)
// ============================================

export class TimeRangeDto {
  @IsString()
  startTime: string; // "09:00"

  @IsString()
  endTime: string; // "18:00"
}

/**
 * Create an exception for a single day (date) or a range (dateFrom..dateTo inclusive).
 * - isClosed=true → slots are ignored and the day becomes unavailable.
 * - isClosed=false → `slots` defines one or more time ranges for that day.
 */
export class CreateEmployeeExceptionDto {
  // Single-day OR range: exactly one of these modes must be used
  @IsString()
  @IsOptional()
  date?: string; // "2026-04-27"

  @IsString()
  @IsOptional()
  dateFrom?: string;

  @IsString()
  @IsOptional()
  dateTo?: string;

  @IsBoolean()
  isClosed: boolean;

  // Required when isClosed = false
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  slots?: TimeRangeDto[];

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}

export class ListEmployeeExceptionsDto {
  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}
