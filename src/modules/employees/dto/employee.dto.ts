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
