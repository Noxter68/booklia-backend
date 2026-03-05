import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class GetCalendarEntriesDto {
  @IsISO8601()
  start: string;

  @IsISO8601()
  end: string;

  @IsOptional()
  @IsString()
  staffId?: string;
}
