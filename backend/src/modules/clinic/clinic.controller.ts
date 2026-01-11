import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ClinicService } from "./clinic.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";

@Controller("clinic")
export class ClinicController {
  constructor(private readonly clinic: ClinicService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("dashboard")
  async dashboard(@Req() req: any) {
    return this.clinic.dashboard(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("therapists")
  async listTherapists(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listTherapists(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("therapists/:therapistId")
  async getTherapist(
    @Req() req: any,
    @Param("therapistId") therapistId: string,
  ) {
    return this.clinic.getTherapist(req.user.userId, therapistId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("clients")
  async listClients(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listClients(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("clients/:clientId")
  async getClient(
    @Req() req: any,
    @Param("clientId") clientId: string,
  ) {
    return this.clinic.getClient(req.user.userId, clientId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("assignments")
  async listAssignments(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listAssignments(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("responses")
  async listResponses(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("reviewed") reviewed?: "all" | "reviewed" | "unreviewed",
    @Query("flagged") flagged?: "all" | "flagged" | "unflagged",
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listResponses(req.user.userId, {
      q: q?.trim() || null,
      reviewed: reviewed || "all",
      flagged: flagged || "all",
      limit,
      cursor: cursor || null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("checkins")
  async listCheckins(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listCheckins(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Get("billing")
  async billing(@Req() req: any) {
    return this.clinic.billing(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Patch("settings")
  async updateSettings(
    @Req() req: any,
    @Body() dto: UpdateClinicSettingsDto,
  ) {
    return this.clinic.updateSettings(req.user.userId, dto);
  }
}
