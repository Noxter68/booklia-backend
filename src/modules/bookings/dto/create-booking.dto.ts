import { IsString, IsOptional, IsInt, IsDateString, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  serviceId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  agreedPriceCents?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
