import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, BadRequestException } from "@nestjs/common";
import { AiSafetyGatewayService } from "./ai-safety-gateway.service";
import { JwtAuthGuard } from "../modules/auth/jwt-auth.guard";
import { RolesGuard } from "../modules/auth/roles.guard";
import { Roles } from "../modules/auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { AiDryRunDto } from "./dto/ai-dryrun.dto";

@Controller("ai")
export class AiSafetyGatewayController {
  constructor(private gateway: AiSafetyGatewayService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN, UserRole.therapist)
  @Post("dry-run")
  async dryRun(@Req() req: any, @Body() dto: AiDryRunDto) {
    return this.gateway.dryRun({
      clinicId: dto.clinicId,
      userId: req.user.userId,
      role: req.user.role,
      purpose: dto.purpose,
      payload: dto.payload,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN)
  @Get("settings/:clinicId")
  async getSettings(@Req() req: any, @Param("clinicId") clinicId: string) {
    return this.gateway.getSettings({
      clinicId,
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN)
  @Put("settings/:clinicId")
  async updateSettings(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Body() body: { enabled?: boolean },
  ) {
    if (typeof body.enabled !== "boolean") {
      throw new BadRequestException("enabled must be boolean");
    }

    return this.gateway.updateSettings({
      clinicId,
      userId: req.user.userId,
      role: req.user.role,
      enabled: body.enabled,
    });
  }
}
