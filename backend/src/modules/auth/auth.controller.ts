import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

import { LoginDto } from "./login.dto";
import { RegisterTherapistDto } from "./register-therapist.dto";
import { RegisterClientDto } from "./register-client.dto";
import { RegisterClinicDto } from "./register-clinic.dto";
import { RegisterClinicTherapistDto } from "./register-clinic-therapist.dto";

function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveClinicId(userId: string, role: string): Promise<string | null> {
    if (role === "CLINIC_ADMIN") {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: userId },
        select: { clinic_id: true },
      });
      return membership?.clinic_id ?? null;
    }

    if (role === "therapist") {
      const therapist = await this.prisma.therapists.findFirst({
        where: { user_id: userId },
        select: { clinic_id: true },
      });
      return therapist?.clinic_id ?? null;
    }

    if (role === "client") {
      const client = await this.prisma.clients.findFirst({
        where: { user_id: userId },
        select: { therapist: { select: { clinic_id: true } } },
      });
      return client?.therapist?.clinic_id ?? null;
    }

    return null;
  }

  @Post("register/therapist")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async registerTherapist(
    @Body() dto: RegisterTherapistDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.registerTherapist(dto);

    res.cookie("access_token", access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Post("register/client")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async registerClientFromInvite(
    @Body() dto: RegisterClientDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.registerClientFromInvite(dto);

    res.cookie("access_token", access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Post("register/clinic")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async registerClinicAdmin(
    @Body() dto: RegisterClinicDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.registerClinicAdmin(dto);

    res.cookie("access_token", access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Get("clinic-invite")
  async lookupClinicInvite(@Req() req: Request) {
    const token = (req.query?.token as string | undefined) ?? "";
    if (!token) {
      return {
        email: "",
        status: "invalid",
        expires_at: null,
        isExpired: true,
      };
    }
    return this.auth.lookupClinicTherapistInvite(token);
  }

  @Post("register/clinic-therapist")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async registerClinicTherapist(
    @Body() dto: RegisterClinicTherapistDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.registerClinicTherapistFromInvite(dto);

    res.cookie("access_token", access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  // Back-compat for frontend route: POST /api/v1/auth/register-client
  @Post("register-client")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async registerClientFromInviteAlias(
    @Body() dto: RegisterClientDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.registerClientFromInvite(dto, res);
  }

  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const { access, refresh, userId } = await this.auth.login(dto.email, dto.password);

    res.cookie("access_token", access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    await this.audit.log({
      userId,
      action: "auth.login",
      entityType: "session",
      ip: req.ip,
      userAgent: req.headers["user-agent"] || undefined,
    });

    return { ok: true };
  }

  @Post("refresh")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies?.refresh_token as string | undefined) ?? "";
    const { access, refresh } = await this.auth.refresh(refreshToken);

    res.cookie("access_token", access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Post("logout")
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies?.refresh_token as string | undefined) ?? "";
    const { userId } = await this.auth.logout(refreshToken).catch(() => ({
      ok: true,
      userId: null,
    }));

    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });

    if (userId) {
      await this.audit.log({
        userId,
        action: "auth.logout",
        entityType: "session",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || undefined,
      });
    }

    return { ok: true };
  }

  // ✅ stable contract used by frontend guards
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() req: any) {
    const resolvedClinicId =
      req.user?.clinicId ??
      (await this.resolveClinicId(req.user.userId, req.user.role).catch(() => null));
    return {
      authenticated: true,
      userId: req.user.userId,
      role: req.user.role,
      clinicId: resolvedClinicId,
    };
  }
}
