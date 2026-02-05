import { IsOptional, IsString, IsUUID, Matches, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class AdherenceContextDto {
  @IsOptional()
  @IsString()
  assignment_title?: string | null;

  @IsOptional()
  @IsString()
  program?: string | null;
}

export class AdherenceAssistDto {
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

  @IsString()
  completion_criteria!: string;

  @IsString()
  client_response!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdherenceContextDto)
  context?: AdherenceContextDto | null;
}
