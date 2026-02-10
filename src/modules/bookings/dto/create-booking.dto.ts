import { IsString, IsOptional, IsInt, IsDateString, Min, ValidateIf } from 'class-validator';

export class CreateBookingDto {
  // For P2P services
  @ValidateIf((o) => !o.businessServiceId)
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  agreedPriceCents?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  // For Business bookings
  @ValidateIf((o) => !o.serviceId)
  @IsString()
  businessServiceId?: string;

  @ValidateIf((o) => !!o.businessServiceId)
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // P2P booking contact info
  @ValidateIf((o) => !!o.serviceId)
  @IsString()
  requesterPhone?: string;

  @IsOptional()
  @IsString()
  requesterAddress?: string;
}

export class RejectBookingDto {
  @IsOptional()
  @IsString()
  message?: string;
}
