import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsISO8601,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

enum ExpenseCategory {
  URSSAF = 'URSSAF',
  RENT = 'RENT',
  MATERIAL = 'MATERIAL',
  SUPPLIER_ORDER = 'SUPPLIER_ORDER',
  INSURANCE = 'INSURANCE',
  SOFTWARE = 'SOFTWARE',
  MARKETING = 'MARKETING',
  OTHER = 'OTHER',
}

export class CreateExpenseDto {
  @IsISO8601()
  date: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
