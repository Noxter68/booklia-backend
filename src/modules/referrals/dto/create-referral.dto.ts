import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReferralDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName!: string;

  // Instagram handle. Stored without leading '@'. Allow letters, digits,
  // dots, underscores (Instagram rules), 1-30 chars.
  @IsString()
  @MaxLength(31) // 30 + optional '@'
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/^@+/, '') : value,
  )
  @Matches(/^[a-zA-Z0-9._]{1,30}$/, {
    message: 'Pseudo Instagram invalide',
  })
  instagram!: string;

  // Phone — accept international format with optional + and spaces/dots/dashes,
  // strip them server-side. Final stored value is digits-only with optional +.
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s.\-()]/g, '') : value,
  )
  @Matches(/^\+?[0-9]{6,15}$/, {
    message: 'Numéro de téléphone invalide',
  })
  phone!: string;
}
