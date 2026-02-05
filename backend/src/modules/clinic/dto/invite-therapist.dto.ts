import { IsEmail, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class InviteTherapistDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @IsOptional()
  @IsUUID()
  clinicId?: string;
}
