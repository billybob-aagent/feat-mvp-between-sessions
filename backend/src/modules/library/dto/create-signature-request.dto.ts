import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateSignatureRequestDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsOptional()
  @IsString()
  dueAt?: string;
}
