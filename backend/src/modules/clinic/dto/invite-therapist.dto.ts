import { IsEmail, IsOptional, IsString, Length } from "class-validator";

export class InviteTherapistDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;
}
