import { IsString, IsUUID, Matches } from "class-validator";

export class SupervisorSummaryDraftDto {
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
}
