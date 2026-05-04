import { IsString, IsOptional, IsBoolean, IsEmail, MaxLength, MinLength, IsISO8601 } from 'class-validator';

export class CreateBusinessClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsISO8601()
  @IsOptional()
  birthDate?: string;
}

export class UpdateBusinessClientDto {
  @IsBoolean()
  @IsOptional()
  isBlocked?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsISO8601()
  @IsOptional()
  birthDate?: string;
}
