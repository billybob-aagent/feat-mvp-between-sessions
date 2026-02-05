import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateAssignmentFromLibraryDto {
  @IsOptional()
  @IsUUID()
  clinicId?: string | null;

  @IsUUID()
  clientId!: string;

  @IsUUID()
  libraryItemId!: string;

  @IsOptional()
  @IsUUID()
  libraryItemVersionId?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  program?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  assignmentTitleOverride?: string | null;
}
