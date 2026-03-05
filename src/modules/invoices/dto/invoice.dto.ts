import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsDateString()
  serviceDate?: string;
}

enum InvoiceLineKind {
  SERVICE = 'SERVICE',
  PRODUCT = 'PRODUCT',
  OTHER = 'OTHER',
}

export class AddInvoiceLineDto {
  @IsOptional()
  @IsEnum(InvoiceLineKind)
  kind?: InvoiceLineKind;

  @IsString()
  label: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPriceHTCents: number;

  @IsNumber()
  @Min(0)
  vatRate: number;
}

export class UpdateInvoiceLineDto {
  @IsOptional()
  @IsEnum(InvoiceLineKind)
  kind?: InvoiceLineKind;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPriceHTCents?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;
}
