import { IsString, IsOptional, IsArray, IsObject, MinLength } from 'class-validator';

export class UpsertBookingNoteDto {
  @IsString()
  bookingId: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsObject()
  structured?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
