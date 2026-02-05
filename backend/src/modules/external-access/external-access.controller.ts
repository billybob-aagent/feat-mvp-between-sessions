import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { ExternalAccessService } from "./external-access.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { CreateExternalAccessTokenDto } from "./dto/create-external-access-token.dto";
import { RevokeExternalAccessTokenDto } from "./dto/revoke-external-access-token.dto";

@Controller("external-access")
export class ExternalAccessController {
  constructor(private externalAccess: ExternalAccessService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("aer")
  async createAerToken(@Req() req: any, @Body() dto: CreateExternalAccessTokenDto) {
    return this.externalAccess.createAerToken({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: dto.clinicId,
      clientId: dto.clientId,
      start: dto.start,
      end: dto.end,
      program: dto.program ?? null,
      format: dto.format,
      ttlMinutes: dto.ttlMinutes,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("revoke")
  @HttpCode(200)
  async revoke(@Req() req: any, @Body() dto: RevokeExternalAccessTokenDto) {
    return this.externalAccess.revokeToken({
      userId: req.user.userId,
      role: req.user.role,
      tokenId: dto.tokenId,
    });
  }
}
