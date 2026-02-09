import { IsOptional, IsString, IsArray, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

export class AddProfileImageDto {
  @IsString()
  url: string;
}

export class ReorderProfileImagesDto {
  @IsArray()
  @IsString({ each: true })
  imageIds: string[];
}
