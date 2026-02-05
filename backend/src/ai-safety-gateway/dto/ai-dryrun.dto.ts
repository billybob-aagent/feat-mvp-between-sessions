import { IsEnum, IsObject, IsUUID } from "class-validator";
import { AiPurpose } from "@prisma/client";

export class AiDryRunDto {
  @IsUUID()
  clinicId!: string;

  @IsEnum(AiPurpose)
  purpose!: AiPurpose;

  @IsObject()
  payload!: Record<string, any>;
}
