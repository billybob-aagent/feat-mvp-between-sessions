import { IsOptional, IsString, IsUUID } from "class-validator";

export class ResolveEscalationDto {
  @IsUUID()
  clinicId!: string;

  @IsOptional()
  @IsString()
  note?: string | null;
}
