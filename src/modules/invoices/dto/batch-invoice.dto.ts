import { IsDateString } from 'class-validator';

export class BatchGenerateDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
