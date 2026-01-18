import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class RagQueryDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
