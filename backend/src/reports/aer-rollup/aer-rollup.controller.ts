import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AerRollupService } from "./aer-rollup.service";
import { JwtAuthGuard } from "../../modules/auth/jwt-auth.guard";
import { RolesGuard } from "../../modules/auth/roles.guard";
import { Roles } from "../../modules/auth/roles.decorator";
import { UserRole } from "@prisma/client";

function parseDateParam(value: string, isEnd: boolean) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("Invalid date");
  }
  if (value.length === 10) {
    if (isEnd) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
  }
  return parsed;
}

@Controller("reports/aer-rollup")
export class AerRollupController {
  constructor(private aerRollup: AerRollupService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get(":clinicId")
  async generate(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("program") program?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setHours(23, 59, 59, 999);

    const endDate = end?.trim() ? parseDateParam(end.trim(), true) : defaultEnd;
    const defaultStart = new Date(endDate);
    defaultStart.setDate(defaultStart.getDate() - 30);
    defaultStart.setHours(0, 0, 0, 0);

    const startDate = start?.trim()
      ? parseDateParam(start.trim(), false)
      : defaultStart;

    if (startDate > endDate) {
      throw new BadRequestException("Start date must be before end date");
    }

    const limit = Math.min(Math.max(parseInt(limitRaw || "100", 10) || 100, 1), 500);

    await this.aerRollup.ensureClinicAccess(req.user.userId, req.user.role, clinicId);

    return this.aerRollup.generateRollup({
      clinicId,
      start: startDate,
      end: endDate,
      program: program?.trim() || null,
      limit,
      cursor: cursor || null,
    });
  }
}
