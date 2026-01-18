import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateLibraryItemDto {
  @IsOptional()
  @IsString()
  collectionId?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  sections?: Record<string, any>;

  @IsOptional()
  @IsString()
  changeSummary?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
