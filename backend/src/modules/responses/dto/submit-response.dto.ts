import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SubmitResponseDto {
  @IsUUID()
  assignmentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  voiceKey?: string;
}
