import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { SupervisorActionsService } from "./supervisor-actions.service";
import { JwtAuthGuard } from "../modules/auth/jwt-auth.guard";
import { RolesGuard } from "../modules/auth/roles.guard";
import { Roles } from "../modules/auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { EscalateDto } from "./dto/escalate.dto";
import { ResolveEscalationDto } from "./dto/resolve.dto";

@Controller("supervisor-actions")
export class SupervisorActionsController {
  constructor(private service: SupervisorActionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("escalate")
  async escalate(@Req() req: any, @Body() dto: EscalateDto) {
    return this.service.createEscalation({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: dto.clinicId,
      clientId: dto.clientId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      reason: dto.reason,
      note: dto.note ?? null,
      assignToTherapistId: dto.assignToTherapistId ?? null,
      ip: req.ip,
      userAgent: req.headers?.["user-agent"],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("escalate/:escalationId/resolve")
  async resolve(
    @Req() req: any,
    @Param("escalationId") escalationId: string,
    @Body() dto: ResolveEscalationDto,
  ) {
    return this.service.resolveEscalation({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: dto.clinicId,
      escalationId,
      note: dto.note ?? null,
      ip: req.ip,
      userAgent: req.headers?.["user-agent"],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("escalations/:escalationId/note")
  async updateNote(
    @Req() req: any,
    @Param("escalationId") escalationId: string,
    @Body() dto: { clinicId?: string; note?: string | null; source?: string | null },
  ) {
    if (!dto.clinicId) {
      throw new BadRequestException("clinicId is required");
    }
    return this.service.updateEscalationNote({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: dto.clinicId,
      escalationId,
      note: dto.note ?? null,
      source: dto.source ?? null,
      ip: req.ip,
      userAgent: req.headers?.["user-agent"],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("escalations/:clinicId")
  async list(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Query("status") status?: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const normalizedStatus = (status ?? "OPEN").toUpperCase();
    if (!["OPEN", "RESOLVED", "ALL"].includes(normalizedStatus)) {
      throw new BadRequestException("Invalid status filter");
    }
    const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
    if (Number.isNaN(limitParsed)) {
      throw new BadRequestException("Invalid limit");
    }
    const limit = Math.min(Math.max(limitParsed, 1), 200);

    return this.service.listEscalations({
      userId: req.user.userId,
      role: req.user.role,
      clinicId,
      status: normalizedStatus as "OPEN" | "RESOLVED" | "ALL",
      start: start?.trim() || undefined,
      end: end?.trim() || undefined,
      limit,
    });
  }
}
