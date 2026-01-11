import { IsBoolean } from "class-validator";

export class PublishAssignmentDto {
  @IsBoolean()
  published!: boolean;
}

