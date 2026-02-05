import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";

export class CreateExternalAccessTokenDto {
  @IsUUID()
  clinicId!: string;

  @IsUUID()
  clientId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  end!: string;

  @IsOptional()
  @IsString()
  program?: string | null;

  @IsIn(["pdf", "json"])
  format!: "pdf" | "json";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  ttlMinutes?: number;
}
