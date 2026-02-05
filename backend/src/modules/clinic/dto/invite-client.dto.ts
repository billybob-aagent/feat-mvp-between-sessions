import { IsEmail, IsOptional, IsUUID } from "class-validator";

export class InviteClientDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUUID()
  therapistId?: string;

  @IsOptional()
  @IsUUID()
  clinicId?: string;
}
