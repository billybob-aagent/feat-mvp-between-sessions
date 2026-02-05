import { IsUUID } from "class-validator";

export class RevokeExternalAccessTokenDto {
  @IsUUID()
  tokenId!: string;
}
