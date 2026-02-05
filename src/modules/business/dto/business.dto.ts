import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  MinLength,
  MaxLength,
  IsEmail,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessTier } from '@prisma/client';

export class CreateBusinessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.logoUrl !== '' && o.logoUrl !== undefined)
  @IsUrl()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.coverUrl !== '' && o.coverUrl !== undefined)
  @IsUrl()
  coverUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== undefined)
  @IsEmail()
  email?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.website !== '' && o.website !== undefined)
  @IsUrl()
  website?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  country?: string;
}

export class UpdateBusinessDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.logoUrl !== '' && o.logoUrl !== undefined)
  @IsUrl()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.coverUrl !== '' && o.coverUrl !== undefined)
  @IsUrl()
  coverUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== undefined)
  @IsEmail()
  email?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.website !== '' && o.website !== undefined)
  @IsUrl()
  website?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsBoolean()
  @IsOptional()
  acceptsOnlineBooking?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateBusinessServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  priceCents: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  durationMinutes: number;

  @IsString()
  @IsOptional()
  categoryId?: string;
}

export class UpdateBusinessServiceDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @IsOptional()
  priceCents?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SearchBusinessDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  offset?: number;
}
