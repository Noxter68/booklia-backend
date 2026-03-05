import { IsString, IsISO8601, IsOptional } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  employeeId: string;

  @IsString()
  businessServiceId: string;

  @IsISO8601()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  clientUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
