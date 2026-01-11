import { IsString, MinLength, MaxLength } from "class-validator";

export class UpdateTherapistNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  note!: string;
}
