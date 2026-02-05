import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";
import { InviteTherapistDto } from "./dto/invite-therapist.dto";
import { InviteClientDto } from "./dto/invite-client.dto";
import { CreateTherapistDto } from "./dto/create-therapist.dto";
import { AuditService } from "../audit/audit.service";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { InviteStatus, UserRole } from "@prisma/client";

export type ClinicDashboardDto = {
  clinic: {
    id: string;
    name: string;
    timezone: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  counts: {
    therapists: number;
    clients: number;
    assignments: number;
    responses: number;
    checkinsLast7d: number;
  };
};

export type ClinicTherapistListItemDto = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  isDisabled: boolean;
  organization: string | null;
  timezone: string;
  createdAt: string;
  clientCount: number;
  assignmentCount: number;
};

export type ClinicTherapistDetailDto = {
  id: string;
  fullName: string;
  email: string;
  isDisabled: boolean;
  organization: string | null;
  timezone: string;
  createdAt: string;
  clientCount: number;
  assignmentCount: number;
  responseCount: number;
  lastAssignmentAt: string | null;
  lastResponseAt: string | null;
};

export type ClinicClientListItemDto = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  therapistId: string;
  therapistName: string | null;
  createdAt: string;
  assignmentCount: number;
  responseCount: number;
  checkinCount: number;
};

export type ClinicClientDetailDto = {
  id: string;
  fullName: string;
  email: string;
  therapistId: string;
  therapistName: string | null;
  createdAt: string;
  assignmentCount: number;
  responseCount: number;
  checkinCount: number;
  lastCheckinAt: string | null;
};

export type ClinicInviteListItemDto = {
  id: string;
  email: string;
  status: InviteStatus;
  isExpired: boolean;
  expiresAt: string;
  createdAt: string;
  therapistId?: string | null;
  therapistName?: string | null;
};

export type ClinicAssignmentListItemDto = {
  id: string;
  title: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  publishedAt: string | null;
  therapistId: string;
  therapistName: string | null;
  clientId: string;
  clientName: string | null;
  responseCount: number;
};

export type ClinicResponseListItemDto = {
  id: string;
  assignmentId: string;
  assignmentTitle: string | null;
  clientId: string;
  clientName: string | null;
  therapistId: string;
  therapistName: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
  flaggedAt: string | null;
  hasTherapistNote: boolean;
  voiceStorageKey: string | null;
};

export type ClinicCheckinListItemDto = {
  id: string;
  clientId: string;
  clientName: string | null;
  therapistId: string;
  therapistName: string | null;
  mood: number;
  createdAt: string;
};

@Injectable()
export class ClinicService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async requireClinicMembership(userId: string) {
    const membership = await this.prisma.clinic_memberships.findFirst({
      where: { user_id: userId },
      include: { clinic: true },
    });
    if (!membership) throw new ForbiddenException("Clinic membership required");
    return { clinicId: membership.clinic_id, clinic: membership.clinic };
  }

  private async resolveClinicAccess(params: {
    userId: string;
    role: UserRole;
    clinicId?: string | null;
  }) {
    if (params.role === UserRole.admin) {
      if (!params.clinicId) {
        throw new BadRequestException("clinicId is required for admin access");
      }
      const clinic = await this.prisma.clinics.findUnique({
        where: { id: params.clinicId },
      });
      if (!clinic) throw new NotFoundException("Clinic not found");
      return { clinicId: clinic.id, clinic };
    }

    return this.requireClinicMembership(params.userId);
  }

  async dashboard(userId: string): Promise<ClinicDashboardDto> {
    const { clinicId, clinic } = await this.requireClinicMembership(userId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [therapists, clients, assignments, responses, checkinsLast7d] =
      await Promise.all([
        this.prisma.therapists.count({ where: { clinic_id: clinicId } }),
        this.prisma.clients.count({
          where: { therapist: { clinic_id: clinicId } },
        }),
        this.prisma.assignments.count({
          where: { therapist: { clinic_id: clinicId } },
        }),
        this.prisma.responses.count({
          where: { assignment: { therapist: { clinic_id: clinicId } } },
        }),
        this.prisma.checkins.count({
          where: {
            client: { therapist: { clinic_id: clinicId } },
            created_at: { gte: sevenDaysAgo },
          },
        }),
      ]);

    return {
      clinic: {
        id: clinic.id,
        name: clinic.name,
        timezone: clinic.timezone,
        logoUrl: clinic.logo_url ?? null,
        primaryColor: clinic.primary_color ?? null,
      },
      counts: {
        therapists,
        clients,
        assignments,
        responses,
        checkinsLast7d,
      },
    };
  }

  async inviteTherapist(
    userId: string,
    dto: InviteTherapistDto,
    role: UserRole,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role,
      clinicId: dto.clinicId ?? null,
    });
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already registered");

    const pendingInvite = await this.prisma.clinic_therapist_invites.findFirst({
      where: {
        clinic_id: clinicId,
        email,
        status: InviteStatus.pending,
      },
    });
    if (pendingInvite) throw new BadRequestException("Invite already pending for this email");

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.clinic_therapist_invites.create({
      data: {
        clinic_id: clinicId,
        email,
        token,
        status: InviteStatus.pending,
        expires_at: expiresAt,
      },
    });

    await this.audit.log({
      userId,
      action: "clinic.therapist_invite.pending",
      entityType: "clinic_therapist_invite",
      entityId: invite.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email },
    });

    return { token: invite.token, expires_at: invite.expires_at };
  }

  async listTherapistInvites(userId: string, opts: { clinicId?: string | null; role: UserRole; status?: InviteStatus | "all" }) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: opts.role,
      clinicId: opts.clinicId ?? null,
    });
    const now = new Date();
    const where: any = { clinic_id: clinicId };
    if (opts.status && opts.status !== "all") {
      if (opts.status === InviteStatus.expired) {
        where.status = InviteStatus.pending;
        where.expires_at = { lt: now };
      } else {
        where.status = opts.status;
      }
    }

    const rows = await this.prisma.clinic_therapist_invites.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        status: true,
        expires_at: true,
        created_at: true,
      },
    });

    return rows.map((row) => {
      const isExpired = row.status === InviteStatus.pending && row.expires_at.getTime() < now.getTime();
      return {
        id: row.id,
        email: row.email,
        status: row.status,
        isExpired,
        expiresAt: row.expires_at.toISOString(),
        createdAt: row.created_at.toISOString(),
      } satisfies ClinicInviteListItemDto;
    });
  }

  async resendTherapistInvite(
    userId: string,
    params: { inviteId: string; clinicId?: string | null; role: UserRole },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: params.role,
      clinicId: params.clinicId ?? null,
    });
    const invite = await this.prisma.clinic_therapist_invites.findFirst({
      where: { id: params.inviteId, clinic_id: clinicId },
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status === InviteStatus.accepted) {
      throw new BadRequestException("Invite already accepted");
    }
    if (invite.status === InviteStatus.revoked) {
      throw new BadRequestException("Invite revoked");
    }

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.clinic_therapist_invites.update({
      where: { id: invite.id },
      data: {
        token,
        status: InviteStatus.pending,
        expires_at: expiresAt,
      },
    });

    await this.audit.log({
      userId,
      action: "clinic.therapist_invite.resent",
      entityType: "clinic_therapist_invite",
      entityId: updated.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email: updated.email },
    });

    return { token: updated.token, expires_at: updated.expires_at };
  }

  async revokeTherapistInvite(
    userId: string,
    params: { inviteId: string; clinicId?: string | null; role: UserRole },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: params.role,
      clinicId: params.clinicId ?? null,
    });
    const invite = await this.prisma.clinic_therapist_invites.findFirst({
      where: { id: params.inviteId, clinic_id: clinicId },
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status === InviteStatus.accepted) {
      throw new BadRequestException("Invite already accepted");
    }

    const updated = await this.prisma.clinic_therapist_invites.update({
      where: { id: invite.id },
      data: { status: InviteStatus.revoked },
    });

    await this.audit.log({
      userId,
      action: "clinic.therapist_invite.revoked",
      entityType: "clinic_therapist_invite",
      entityId: updated.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email: updated.email },
    });

    return { ok: true };
  }

  async inviteClient(
    userId: string,
    dto: InviteClientDto,
    role: UserRole,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role,
      clinicId: dto.clinicId ?? null,
    });
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already registered");

    const therapistId = dto.therapistId
      ? dto.therapistId
      : await this.resolveDefaultTherapistId(clinicId);

    const therapist = await this.prisma.therapists.findFirst({
      where: { id: therapistId, clinic_id: clinicId },
      select: { id: true },
    });
    if (!therapist) {
      throw new BadRequestException("Therapist not found for clinic");
    }

    const existingInvite = await this.prisma.invites.findFirst({
      where: {
        email,
        status: InviteStatus.pending,
        therapist: { clinic_id: clinicId },
      },
    });
    if (existingInvite) {
      throw new BadRequestException("Invite already pending for this email");
    }

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await this.prisma.invites.create({
      data: {
        therapist_id: therapistId,
        email,
        token,
        status: InviteStatus.pending,
        expires_at: expiresAt,
      },
    });

    await this.audit.log({
      userId,
      action: "clinic.client_invite.pending",
      entityType: "invite",
      entityId: invite.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email, therapistId },
    });

    return { token: invite.token, expires_at: invite.expires_at };
  }

  private async resolveDefaultTherapistId(clinicId: string) {
    const therapists = await this.prisma.therapists.findMany({
      where: { clinic_id: clinicId },
      select: { id: true },
      orderBy: { created_at: "asc" },
      take: 2,
    });

    if (therapists.length === 1) return therapists[0].id;
    if (therapists.length === 0) {
      throw new BadRequestException("No therapists available for client assignment");
    }

    throw new BadRequestException("Therapist assignment required for this clinic");
  }

  async listClientInvites(userId: string, opts: { clinicId?: string | null; role: UserRole; status?: InviteStatus | "all" }) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: opts.role,
      clinicId: opts.clinicId ?? null,
    });
    const now = new Date();
    const where: any = {
      therapist: { clinic_id: clinicId },
    };
    if (opts.status && opts.status !== "all") {
      if (opts.status === InviteStatus.expired) {
        where.status = InviteStatus.pending;
        where.expires_at = { lt: now };
      } else {
        where.status = opts.status;
      }
    }

    const rows = await this.prisma.invites.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        status: true,
        expires_at: true,
        created_at: true,
        therapist: { select: { id: true, full_name: true } },
      },
    });

    return rows.map((row) => {
      const isExpired = row.status === InviteStatus.pending && row.expires_at.getTime() < now.getTime();
      return {
        id: row.id,
        email: row.email,
        status: row.status,
        isExpired,
        expiresAt: row.expires_at.toISOString(),
        createdAt: row.created_at.toISOString(),
        therapistId: row.therapist.id,
        therapistName: row.therapist.full_name ?? null,
      } satisfies ClinicInviteListItemDto;
    });
  }

  async resendClientInvite(
    userId: string,
    params: { inviteId: string; clinicId?: string | null; role: UserRole },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: params.role,
      clinicId: params.clinicId ?? null,
    });
    const invite = await this.prisma.invites.findFirst({
      where: { id: params.inviteId, therapist: { clinic_id: clinicId } },
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status === InviteStatus.accepted) {
      throw new BadRequestException("Invite already accepted");
    }
    if (invite.status === InviteStatus.revoked) {
      throw new BadRequestException("Invite revoked");
    }

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.invites.update({
      where: { id: invite.id },
      data: {
        token,
        status: InviteStatus.pending,
        expires_at: expiresAt,
      },
    });

    await this.audit.log({
      userId,
      action: "clinic.client_invite.resent",
      entityType: "invite",
      entityId: updated.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email: updated.email },
    });

    return { token: updated.token, expires_at: updated.expires_at };
  }

  async revokeClientInvite(
    userId: string,
    params: { inviteId: string; clinicId?: string | null; role: UserRole },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: params.role,
      clinicId: params.clinicId ?? null,
    });
    const invite = await this.prisma.invites.findFirst({
      where: { id: params.inviteId, therapist: { clinic_id: clinicId } },
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status === InviteStatus.accepted) {
      throw new BadRequestException("Invite already accepted");
    }

    const updated = await this.prisma.invites.update({
      where: { id: invite.id },
      data: { status: InviteStatus.revoked },
    });

    await this.audit.log({
      userId,
      action: "clinic.client_invite.revoked",
      entityType: "invite",
      entityId: updated.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email: updated.email },
    });

    return { ok: true };
  }

  async disableUser(
    userId: string,
    params: { targetUserId: string; clinicId?: string | null; role: UserRole },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: params.role,
      clinicId: params.clinicId ?? null,
    });

    const target = await this.prisma.users.findUnique({
      where: { id: params.targetUserId },
      include: {
        therapist: { select: { clinic_id: true } },
        client: { select: { therapist: { select: { clinic_id: true } } } },
        clinic_memberships: { select: { clinic_id: true } },
      },
    });
    if (!target) throw new NotFoundException("User not found");

    const clinicMatch =
      target.therapist?.clinic_id === clinicId ||
      target.client?.therapist?.clinic_id === clinicId ||
      target.clinic_memberships.some((m) => m.clinic_id === clinicId);

    if (!clinicMatch) throw new ForbiddenException("User not in clinic");

    await this.prisma.users.update({
      where: { id: target.id },
      data: { is_disabled: true },
    });

    await this.audit.log({
      userId,
      action: "clinic.user_disabled",
      entityType: "user",
      entityId: target.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email: target.email },
    });

    return { ok: true };
  }

  async createTherapist(
    userId: string,
    dto: CreateTherapistDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { clinicId } = await this.requireClinicMembership(userId);
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();

    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already registered");

    const password_hash = await argon2.hash(dto.password);

    const user = await this.prisma.users.create({
      data: {
        email,
        password_hash,
        role: "therapist",
        email_verified_at: process.env.EMAIL_ENABLED === "true" ? null : new Date(),
        therapist: {
          create: {
            full_name: fullName,
            organization: dto.organization?.trim() || null,
            timezone: dto.timezone?.trim() || "UTC",
            clinic_id: clinicId,
          },
        },
      },
      include: { therapist: true },
    });

    await this.audit.log({
      userId,
      action: "clinic.therapist_create",
      entityType: "therapist",
      entityId: user.therapist?.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { email },
    });

    return {
      id: user.therapist?.id,
      fullName: user.therapist?.full_name,
      email: user.email,
    };
  }

  async listTherapists(userId: string, opts: { q: string | null; limit: number; cursor: string | null; clinicId?: string | null; role: UserRole }) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: opts.role,
      clinicId: opts.clinicId ?? null,
    });
    const where: any = { clinic_id: clinicId };
    if (opts.q) {
      where.OR = [
        { full_name: { contains: opts.q, mode: "insensitive" } },
        { user: { email: { contains: opts.q, mode: "insensitive" } } },
      ];
    }

    const rows = await this.prisma.therapists.findMany({
      where,
      orderBy: { id: "desc" },
      take: opts.limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        full_name: true,
        organization: true,
        timezone: true,
        created_at: true,
        user: { select: { id: true, email: true, is_disabled: true } },
        _count: { select: { clients: true, assignments: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: ClinicTherapistListItemDto[] = sliced.map((row) => ({
      id: row.id,
      userId: row.user.id,
      fullName: row.full_name,
      email: row.user.email,
      isDisabled: row.user.is_disabled,
      organization: row.organization ?? null,
      timezone: row.timezone,
      createdAt: row.created_at.toISOString(),
      clientCount: row._count.clients,
      assignmentCount: row._count.assignments,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async getTherapist(userId: string, therapistId: string): Promise<ClinicTherapistDetailDto> {
    const { clinicId } = await this.requireClinicMembership(userId);
    const therapist = await this.prisma.therapists.findFirst({
      where: { id: therapistId, clinic_id: clinicId },
      select: {
        id: true,
        full_name: true,
        organization: true,
        timezone: true,
        created_at: true,
        user: { select: { email: true, is_disabled: true } },
        _count: { select: { clients: true, assignments: true } },
      },
    });
    if (!therapist) throw new NotFoundException("Therapist not found");

    const [responseCount, lastAssignment, lastResponse] = await Promise.all([
      this.prisma.responses.count({
        where: { assignment: { therapist_id: therapist.id } },
      }),
      this.prisma.assignments.findFirst({
        where: { therapist_id: therapist.id },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      }),
      this.prisma.responses.findFirst({
        where: { assignment: { therapist_id: therapist.id } },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      }),
    ]);

    return {
      id: therapist.id,
      fullName: therapist.full_name,
      email: therapist.user.email,
      isDisabled: therapist.user.is_disabled,
      organization: therapist.organization ?? null,
      timezone: therapist.timezone,
      createdAt: therapist.created_at.toISOString(),
      clientCount: therapist._count.clients,
      assignmentCount: therapist._count.assignments,
      responseCount,
      lastAssignmentAt: lastAssignment?.created_at
        ? lastAssignment.created_at.toISOString()
        : null,
      lastResponseAt: lastResponse?.created_at
        ? lastResponse.created_at.toISOString()
        : null,
    };
  }

  async listClients(userId: string, opts: { q: string | null; limit: number; cursor: string | null; clinicId?: string | null; role: UserRole }) {
    const { clinicId } = await this.resolveClinicAccess({
      userId,
      role: opts.role,
      clinicId: opts.clinicId ?? null,
    });
    const where: any = { therapist: { clinic_id: clinicId } };
    if (opts.q) {
      where.OR = [
        { full_name: { contains: opts.q, mode: "insensitive" } },
        { user: { email: { contains: opts.q, mode: "insensitive" } } },
        { therapist: { full_name: { contains: opts.q, mode: "insensitive" } } },
      ];
    }

    const rows = await this.prisma.clients.findMany({
      where,
      orderBy: { id: "desc" },
      take: opts.limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        full_name: true,
        created_at: true,
        user: { select: { id: true, email: true } },
        therapist: { select: { id: true, full_name: true } },
        _count: { select: { assignments: true, responses: true, checkins: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: ClinicClientListItemDto[] = sliced.map((row) => ({
      id: row.id,
      userId: row.user.id,
      fullName: row.full_name,
      email: row.user.email,
      therapistId: row.therapist.id,
      therapistName: row.therapist.full_name ?? null,
      createdAt: row.created_at.toISOString(),
      assignmentCount: row._count.assignments,
      responseCount: row._count.responses,
      checkinCount: row._count.checkins,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async getClient(userId: string, clientId: string): Promise<ClinicClientDetailDto> {
    const { clinicId } = await this.requireClinicMembership(userId);
    const client = await this.prisma.clients.findFirst({
      where: { id: clientId, therapist: { clinic_id: clinicId } },
      select: {
        id: true,
        full_name: true,
        created_at: true,
        user: { select: { email: true } },
        therapist: { select: { id: true, full_name: true } },
        _count: { select: { assignments: true, responses: true, checkins: true } },
      },
    });
    if (!client) throw new NotFoundException("Client not found");

    const lastCheckin = await this.prisma.checkins.findFirst({
      where: { client_id: client.id },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    });

    return {
      id: client.id,
      fullName: client.full_name,
      email: client.user.email,
      therapistId: client.therapist.id,
      therapistName: client.therapist.full_name ?? null,
      createdAt: client.created_at.toISOString(),
      assignmentCount: client._count.assignments,
      responseCount: client._count.responses,
      checkinCount: client._count.checkins,
      lastCheckinAt: lastCheckin?.created_at ? lastCheckin.created_at.toISOString() : null,
    };
  }

  async listAssignments(userId: string, opts: { q: string | null; limit: number; cursor: string | null; clientId: string | null }) {
    const { clinicId } = await this.requireClinicMembership(userId);
    const where: any = { therapist: { clinic_id: clinicId } };
    if (opts.clientId) {
      where.client_id = opts.clientId;
    }
    if (opts.q) {
      where.OR = [
        { title: { contains: opts.q, mode: "insensitive" } },
        { client: { full_name: { contains: opts.q, mode: "insensitive" } } },
        { therapist: { full_name: { contains: opts.q, mode: "insensitive" } } },
      ];
    }

    const rows = await this.prisma.assignments.findMany({
      where,
      orderBy: { id: "desc" },
      take: opts.limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        title: true,
        status: true,
        due_date: true,
        created_at: true,
        published_at: true,
        therapist: { select: { id: true, full_name: true } },
        client: { select: { id: true, full_name: true } },
        _count: { select: { responses: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: ClinicAssignmentListItemDto[] = sliced.map((row) => ({
      id: row.id,
      title: row.title ?? null,
      status: row.status,
      dueDate: row.due_date ? row.due_date.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      therapistId: row.therapist.id,
      therapistName: row.therapist.full_name ?? null,
      clientId: row.client.id,
      clientName: row.client.full_name ?? null,
      responseCount: row._count.responses,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async listResponses(
    userId: string,
    opts: {
      q: string | null;
      reviewed: "all" | "reviewed" | "unreviewed";
      flagged: "all" | "flagged" | "unflagged";
      limit: number;
      cursor: string | null;
      clientId: string | null;
    },
  ) {
    const { clinicId } = await this.requireClinicMembership(userId);
    const where: any = {
      assignment: { therapist: { clinic_id: clinicId } },
    };
    if (opts.clientId) {
      where.client_id = opts.clientId;
    }
    if (opts.reviewed === "reviewed") where.reviewed_at = { not: null };
    if (opts.reviewed === "unreviewed") where.reviewed_at = null;
    if (opts.flagged === "flagged") where.flagged_at = { not: null };
    if (opts.flagged === "unflagged") where.flagged_at = null;

    if (opts.q) {
      where.OR = [
        { client: { full_name: { contains: opts.q, mode: "insensitive" } } },
        { client: { user: { email: { contains: opts.q, mode: "insensitive" } } } },
        { assignment: { title: { contains: opts.q, mode: "insensitive" } } },
      ];
    }

    const rows = await this.prisma.responses.findMany({
      where,
      orderBy: { id: "desc" },
      take: opts.limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        assignment_id: true,
        client_id: true,
        created_at: true,
        reviewed_at: true,
        flagged_at: true,
        therapist_note_cipher: true,
        voice_storage_key: true,
        assignment: {
          select: {
            title: true,
            therapist: { select: { id: true, full_name: true } },
          },
        },
        client: { select: { id: true, full_name: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: ClinicResponseListItemDto[] = sliced.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment?.title ?? null,
      clientId: row.client_id,
      clientName: row.client?.full_name ?? null,
      therapistId: row.assignment?.therapist?.id ?? "",
      therapistName: row.assignment?.therapist?.full_name ?? null,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      flaggedAt: row.flagged_at ? row.flagged_at.toISOString() : null,
      hasTherapistNote: Boolean(row.therapist_note_cipher),
      voiceStorageKey: row.voice_storage_key ?? null,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async listCheckins(userId: string, opts: { q: string | null; limit: number; cursor: string | null; clientId: string | null }) {
    const { clinicId } = await this.requireClinicMembership(userId);
    const where: any = { client: { therapist: { clinic_id: clinicId } } };
    if (opts.clientId) {
      where.client_id = opts.clientId;
    }
    if (opts.q) {
      where.OR = [
        { client: { full_name: { contains: opts.q, mode: "insensitive" } } },
        { client: { user: { email: { contains: opts.q, mode: "insensitive" } } } },
        { client: { therapist: { full_name: { contains: opts.q, mode: "insensitive" } } } },
      ];
    }

    const rows = await this.prisma.checkins.findMany({
      where,
      orderBy: { id: "desc" },
      take: opts.limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        mood: true,
        created_at: true,
        client: {
          select: {
            id: true,
            full_name: true,
            therapist: { select: { id: true, full_name: true } },
          },
        },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: ClinicCheckinListItemDto[] = sliced.map((row) => ({
      id: row.id,
      clientId: row.client.id,
      clientName: row.client.full_name ?? null,
      therapistId: row.client.therapist.id,
      therapistName: row.client.therapist.full_name ?? null,
      mood: row.mood,
      createdAt: row.created_at.toISOString(),
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async billing(userId: string) {
    const { clinic } = await this.requireClinicMembership(userId);
    return {
      clinicId: clinic.id,
      status: "not_configured",
    };
  }

  async updateSettings(userId: string, dto: UpdateClinicSettingsDto) {
    const { clinic } = await this.requireClinicMembership(userId);
    const updated = await this.prisma.clinics.update({
      where: { id: clinic.id },
      data: {
        name: dto.name ?? undefined,
        timezone: dto.timezone ?? undefined,
        logo_url: dto.logoUrl ?? undefined,
        primary_color: dto.primaryColor ?? undefined,
      },
    });

    return {
      ok: true,
      clinic: {
        id: updated.id,
        name: updated.name,
        timezone: updated.timezone,
        logoUrl: updated.logo_url ?? null,
        primaryColor: updated.primary_color ?? null,
      },
    };
  }
}
