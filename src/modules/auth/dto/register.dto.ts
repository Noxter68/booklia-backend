import { IsEmail, IsString, MinLength, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MaxLength(50)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsBoolean()
  @IsOptional()
  isBusiness?: boolean;
}
