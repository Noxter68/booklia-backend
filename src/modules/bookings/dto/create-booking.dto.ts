import { IsString, IsOptional, IsInt, IsDateString, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  businessServiceId: string;

  @IsString()
  employeeId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  agreedPriceCents?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectBookingDto {
  @IsOptional()
  @IsString()
  message?: string;
}
