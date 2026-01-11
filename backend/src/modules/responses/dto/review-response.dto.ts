import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  therapistNote?: string;
}
