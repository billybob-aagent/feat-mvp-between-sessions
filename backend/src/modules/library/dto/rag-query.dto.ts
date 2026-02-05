import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class RagQueryDto {
  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
