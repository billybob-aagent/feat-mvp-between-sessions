import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { PilotMetricsService } from "./pilot-metrics.service";

@Controller("metrics")
export class PilotMetricsController {
  constructor(private metrics: PilotMetricsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("pilot/:clinicId")
  async pilotMetrics(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
  ) {
    return this.metrics.getPilotMetrics({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: clinicId.trim(),
      start: start ?? "",
      end: end ?? "",
    });
  }
}
