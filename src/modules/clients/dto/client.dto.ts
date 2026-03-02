import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

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
}
