import { IsEmail, IsString, Length } from "class-validator";

export class CreateClientDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 120)
  fullName!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
