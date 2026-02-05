import { IsOptional, IsString } from "class-validator";

export class PublishLibraryItemDto {
  @IsOptional()
  @IsString()
  changeSummary?: string;
}
