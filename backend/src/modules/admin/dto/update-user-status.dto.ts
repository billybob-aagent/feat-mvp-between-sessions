import { IsBoolean } from "class-validator";

export class UpdateUserStatusDto {
  @IsBoolean()
  disabled!: boolean;
}
