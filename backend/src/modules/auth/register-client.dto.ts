import { IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterClientDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
}
