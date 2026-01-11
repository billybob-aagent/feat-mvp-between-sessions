import { IsOptional, IsString, Length } from "class-validator";

export class RegisterClinicTherapistDto {
  @IsString()
  @Length(10, 200)
  token!: string;

  @IsString()
  @Length(2, 120)
  fullName!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  organization?: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  timezone?: string;
}
