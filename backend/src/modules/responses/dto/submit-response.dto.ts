import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from "class-validator";

export class SubmitResponseDto {
  @IsUUID()
  assignmentId!: string;

  @IsInt()
  @Min(0)
  @Max(10)
  mood!: number;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  prompt?: string;

  @IsOptional()
  @IsString()
  voiceKey?: string;
}
