import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateAssignmentDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

