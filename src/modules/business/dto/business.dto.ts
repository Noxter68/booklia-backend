import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
  MinLength,
  MaxLength,
  IsEmail,
  IsUrl,
  ValidateIf,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessTier, ServicePriceMode } from '@prisma/client';

// Loyalty pricing tier input — surcharge applied when a client returns
// for the same service after `thresholdWeeks` weeks since their last
// COMPLETED booking. Identity (id) is not exposed: tiers are fully
// replaced on update (delete-and-recreate in a transaction).
export class PricingTierInputDto {
  @IsNumber()
  @Min(1)
  thresholdWeeks: number;

  @IsNumber()
  @Min(1)
  surchargeCents: number;
}

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
  @MaxLength(50000)
  presentation?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

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
  @MaxLength(50000)
  presentation?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

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
  autoAcceptBookings?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;
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

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  detailedDescription?: string; // Rich text HTML content

  @IsEnum(ServicePriceMode)
  @IsOptional()
  priceMode?: ServicePriceMode;

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

  @IsString()
  @IsOptional()
  businessCategoryId?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PricingTierInputDto)
  pricingTiers?: PricingTierInputDto[];
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

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  detailedDescription?: string; // Rich text HTML content

  @IsEnum(ServicePriceMode)
  @IsOptional()
  priceMode?: ServicePriceMode;

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

  @IsString()
  @IsOptional()
  businessCategoryId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Full replacement: existing tiers are deleted and recreated from this list.
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PricingTierInputDto)
  pricingTiers?: PricingTierInputDto[];
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
  lat?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lng?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  radius?: number; // in km, default 10

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  offset?: number;

  @IsString()
  @IsOptional()
  sortBy?: 'recent' | 'popular' | 'rating' | 'distance'; // recent = createdAt desc, popular = tier + verified, rating = by rating, distance = closest first
}

// ============================================
// BUSINESS HOURS
// ============================================

export class BusinessHourDto {
  @IsNumber()
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.

  @IsString()
  startTime: string; // "09:00"

  @IsString()
  endTime: string; // "18:00"

  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;
}

export class UpdateBusinessHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  hours: BusinessHourDto[];
}

// ============================================
// BUSINESS CATEGORIES
// ============================================

export class CategoryOptionInputDto {
  // If present, update the existing option with this id (must belong to the category)
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  priceCents: number;

  @IsNumber()
  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  groupName?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateBusinessCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CategoryOptionInputDto)
  options?: CategoryOptionInputDto[];
}

export class UpdateBusinessCategoryDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  // Full replacement of options. Entries with `id` are updated; without id = created;
  // existing options missing from this list are deleted.
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CategoryOptionInputDto)
  options?: CategoryOptionInputDto[];
}

// ============================================
// VACATION MODE
// ============================================

export class UpdateVacationModeDto {
  @IsBoolean()
  isOnVacation: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  vacationMessage?: string;
}

// ============================================
// BUSINESS IMAGES
// ============================================

export class AddBusinessImageDto {
  @IsString()
  @IsUrl()
  url: string;
}

export class ReorderBusinessImagesDto {
  @IsArray()
  @IsString({ each: true })
  imageIds: string[];
}

// ============================================
// BUSINESS PROMOTIONS
// ============================================

export class CreateBusinessPromotionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.imageUrl !== '' && o.imageUrl !== undefined)
  @IsUrl()
  imageUrl?: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBusinessPromotionDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.imageUrl !== '' && o.imageUrl !== undefined)
  @IsUrl()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

