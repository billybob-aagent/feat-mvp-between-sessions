import { IsIn, IsObject, IsOptional, IsString, IsUUID } from "class-validator";

export const ASSESSMENT_TYPES = ["ASAM", "BIOPSYCHOSOCIAL", "MENTAL_STATUS", "OTHER"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export class AssessmentAssistDto {
  @IsUUID()
  clinicId!: string;

  @IsUUID()
  clientId!: string;

  @IsString()
  @IsIn(ASSESSMENT_TYPES)
  assessment_type!: AssessmentType;

  @IsObject()
  inputs!: Record<string, any>;

  @IsOptional()
  @IsString()
  note?: string | null;
}
