import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

enum VatMode {
  FRANCHISE_293B = 'FRANCHISE_293B',
  STANDARD = 'STANDARD',
}

export class UpsertBillingSettingsDto {
  @IsString()
  @MinLength(1)
  legalName: string;

  @IsString()
  @MinLength(1)
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  @MinLength(1)
  postalCode: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  @MinLength(9)
  @MaxLength(17)
  siret: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsEnum(VatMode)
  vatMode: VatMode;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  @Matches(/^[A-Z0-9-]+$/i, { message: 'Le préfixe ne peut contenir que des lettres, chiffres et tirets' })
  invoicePrefix: string;

  @IsOptional()
  @IsString()
  logoKey?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;
}
