import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class SignLibraryItemDto {
  @IsString()
  @IsNotEmpty()
  signerName!: string;

  @IsOptional()
  @IsString()
  typedSignature?: string;

  @IsOptional()
  @IsString()
  drawnSignatureDataUrl?: string;

  @IsOptional()
  @IsObject()
  signerMeta?: Record<string, any>;
}
