import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateLibraryItemDto {
  @IsString()
  @IsNotEmpty()
  collectionId!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsObject()
  metadata!: Record<string, any>;

  @IsObject()
  sections!: Record<string, any>;

  @IsOptional()
  @IsString()
  changeSummary?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
