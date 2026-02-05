import { IsEnum, IsOptional, IsString, IsUUID, Matches } from "class-validator";
import { SupervisorEscalationReason } from "@prisma/client";

export class EscalateDto {
  @IsUUID()
  clinicId!: string;

  @IsUUID()
  clientId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEnd!: string;

  @IsEnum(SupervisorEscalationReason)
  reason!: SupervisorEscalationReason;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsUUID()
  assignToTherapistId?: string | null;
}
