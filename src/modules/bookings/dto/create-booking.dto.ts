import { IsString, IsOptional, IsInt, IsDateString, Min, IsArray } from 'class-validator';

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

  // Selected ServiceOption ids to attach to this booking
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];
}

export class RejectBookingDto {
  @IsOptional()
  @IsString()
  message?: string;
}
