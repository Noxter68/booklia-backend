import { IsOptional, IsString, IsEnum, IsInt, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ServiceKind, Urgency } from '@prisma/client';

export class SearchServicesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(ServiceKind)
  kind?: ServiceKind;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  city?: string;

  // Geolocation search
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  radius?: number = 10; // km

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
