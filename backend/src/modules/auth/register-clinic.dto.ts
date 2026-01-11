import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterClinicDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  clinicName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
