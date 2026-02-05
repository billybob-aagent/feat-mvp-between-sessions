import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ClinicService } from "./clinic.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { InviteStatus, UserRole } from "@prisma/client";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";
import { InviteTherapistDto } from "./dto/invite-therapist.dto";
import { InviteClientDto } from "./dto/invite-client.dto";
import { CreateTherapistDto } from "./dto/create-therapist.dto";

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
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("therapists")
  async listTherapists(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
    @Query("clinicId") clinicId?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listTherapists(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
      clinicId: clinicId?.trim() || null,
      role: req.user.role,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("therapists/invite")
  async inviteTherapist(
    @Req() req: any,
    @Body() dto: InviteTherapistDto,
  ) {
    return this.clinic.inviteTherapist(req.user.userId, dto, req.user.role, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("therapists/invites")
  async listTherapistInvites(
    @Req() req: any,
    @Query("status") status?: InviteStatus | "all",
    @Query("clinicId") clinicId?: string,
  ) {
    return this.clinic.listTherapistInvites(req.user.userId, {
      clinicId: clinicId?.trim() || null,
      role: req.user.role,
      status,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("therapists/invites/:inviteId/resend")
  async resendTherapistInvite(
    @Req() req: any,
    @Param("inviteId") inviteId: string,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.clinic.resendTherapistInvite(
      req.user.userId,
      { inviteId, clinicId: clinicId?.trim() || null, role: req.user.role },
      { ip: req.ip, userAgent: req.headers["user-agent"] },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("therapists/invites/:inviteId/revoke")
  async revokeTherapistInvite(
    @Req() req: any,
    @Param("inviteId") inviteId: string,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.clinic.revokeTherapistInvite(
      req.user.userId,
      { inviteId, clinicId: clinicId?.trim() || null, role: req.user.role },
      { ip: req.ip, userAgent: req.headers["user-agent"] },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN)
  @Post("therapists")
  async createTherapist(
    @Req() req: any,
    @Body() dto: CreateTherapistDto,
  ) {
    return this.clinic.createTherapist(req.user.userId, dto, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
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
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("clients")
  async listClients(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
    @Query("clinicId") clinicId?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listClients(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
      clinicId: clinicId?.trim() || null,
      role: req.user.role,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("clients/invite")
  async inviteClient(@Req() req: any, @Body() dto: InviteClientDto) {
    return this.clinic.inviteClient(req.user.userId, dto, req.user.role, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("clients/invites")
  async listClientInvites(
    @Req() req: any,
    @Query("status") status?: InviteStatus | "all",
    @Query("clinicId") clinicId?: string,
  ) {
    return this.clinic.listClientInvites(req.user.userId, {
      clinicId: clinicId?.trim() || null,
      role: req.user.role,
      status,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("clients/invites/:inviteId/resend")
  async resendClientInvite(
    @Req() req: any,
    @Param("inviteId") inviteId: string,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.clinic.resendClientInvite(
      req.user.userId,
      { inviteId, clinicId: clinicId?.trim() || null, role: req.user.role },
      { ip: req.ip, userAgent: req.headers["user-agent"] },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("clients/invites/:inviteId/revoke")
  async revokeClientInvite(
    @Req() req: any,
    @Param("inviteId") inviteId: string,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.clinic.revokeClientInvite(
      req.user.userId,
      { inviteId, clinicId: clinicId?.trim() || null, role: req.user.role },
      { ip: req.ip, userAgent: req.headers["user-agent"] },
    );
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
    @Query("clientId") clientId?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listAssignments(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
      clientId: clientId?.trim() || null,
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
    @Query("clientId") clientId?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listResponses(req.user.userId, {
      q: q?.trim() || null,
      reviewed: reviewed || "all",
      flagged: flagged || "all",
      limit,
      cursor: cursor || null,
      clientId: clientId?.trim() || null,
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
    @Query("clientId") clientId?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 100);
    return this.clinic.listCheckins(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
      clientId: clientId?.trim() || null,
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post("users/:userId/disable")
  async disableUser(
    @Req() req: any,
    @Param("userId") userId: string,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.clinic.disableUser(
      req.user.userId,
      { targetUserId: userId, clinicId: clinicId?.trim() || null, role: req.user.role },
      { ip: req.ip, userAgent: req.headers["user-agent"] },
    );
  }
}
