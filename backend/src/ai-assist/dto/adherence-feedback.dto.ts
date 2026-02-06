import { IsUUID } from "class-validator";

export class AdherenceFeedbackDraftDto {
  @IsUUID()
  clinicId!: string;

  @IsUUID()
  responseId!: string;
}
