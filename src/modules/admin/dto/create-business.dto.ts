import { IsEmail, IsString, IsOptional, MinLength, IsBoolean, IsNumber } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @MinLength(2)
  businessName: string;

  @IsEmail()
  ownerEmail: string;

  @IsString()
  @MinLength(2)
  ownerFirstName: string;

  @IsString()
  @MinLength(2)
  ownerLastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isEarlyAdopter?: boolean;
}
