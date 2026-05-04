import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateInviteRequestDto {
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

  @IsEmail()
  @MaxLength(120)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  // Phone — strip spaces/dots/dashes, accept optional + and 6-15 digits.
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s.\-()]/g, '') : value,
  )
  @Matches(/^\+?[0-9]{6,15}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;
}
