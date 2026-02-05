import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserRole } from "@prisma/client";

export type AdminUserListItemDto = {
  id: string;
  email: string;
  role: UserRole;
  isDisabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  therapistName: string | null;
  clientName: string | null;
};

export type AdminUserDetailDto = {
  id: string;
  email: string;
  role: UserRole;
  isDisabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  therapist: { id: string; fullName: string; organization: string | null } | null;
  client: { id: string; fullName: string } | null;
};

export type AdminAuditItemDto = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
};

export type AdminAssignmentListItemDto = {
  id: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  publishedAt: string | null;
  title: string | null;
  therapistId: string;
  therapistName: string | null;
  clientId: string;
  clientName: string | null;
};

export type AdminNotificationItemDto = {
  id: string;
  userId: string;
  userEmail: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
  hasPayload: boolean;
};

export type AdminResponseItemDto = {
  id: string;
  assignmentId: string;
  clientId: string;
  createdAt: string | null;
  reviewedAt: string | null;
  flaggedAt: string | null;
  hasTherapistNote: boolean;
  voiceStorageKey: string | null;
};

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers(opts: { limit: number; cursor: string | null }) {
    const rows = await this.prisma.users.findMany({
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
        email: true,
        role: true,
        is_disabled: true,
        created_at: true,
        last_login_at: true,
        therapist: { select: { full_name: true } },
        client: { select: { full_name: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: AdminUserListItemDto[] = sliced.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isDisabled: u.is_disabled,
      createdAt: u.created_at.toISOString(),
      lastLoginAt: u.last_login_at ? u.last_login_at.toISOString() : null,
      therapistName: u.therapist?.full_name ?? null,
      clientName: u.client?.full_name ?? null,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async getUser(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        is_disabled: true,
        created_at: true,
        last_login_at: true,
        therapist: { select: { id: true, full_name: true, organization: true } },
        client: { select: { id: true, full_name: true } },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isDisabled: user.is_disabled,
      createdAt: user.created_at.toISOString(),
      lastLoginAt: user.last_login_at ? user.last_login_at.toISOString() : null,
      therapist: user.therapist
        ? {
            id: user.therapist.id,
            fullName: user.therapist.full_name,
            organization: user.therapist.organization ?? null,
          }
        : null,
      client: user.client
        ? {
            id: user.client.id,
            fullName: user.client.full_name,
          }
        : null,
    };
  }

  async updateUserStatus(userId: string, disabled: boolean) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, is_disabled: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const updated = await this.prisma.users.update({
      where: { id: userId },
      data: { is_disabled: disabled },
      select: {
        id: true,
        is_disabled: true,
      },
    });

    return { id: updated.id, isDisabled: updated.is_disabled };
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        therapist: { select: { id: true } },
        client: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    if (role === UserRole.therapist && !user.therapist) {
      throw new BadRequestException("User has no therapist profile");
    }
    if (role === UserRole.client && !user.client) {
      throw new BadRequestException("User has no client profile");
    }

    const updated = await this.prisma.users.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    });

    return { id: updated.id, role: updated.role };
  }

  async listAudit(opts: { limit: number; cursor: string | null }) {
    const rows = await this.prisma.audit_logs.findMany({
      orderBy: { id: "desc" },
      take: opts.limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
      include: {
        user: { select: { email: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: AdminAuditItemDto[] = sliced.map((row) => ({
      id: row.id,
      userId: row.user_id ?? null,
      userEmail: row.user?.email ?? null,
      action: row.action,
      entityType: row.entity_type ?? null,
      entityId: row.entity_id ?? null,
      ip: row.ip ?? null,
      userAgent: row.user_agent ?? null,
      metadata: (row.metadata as Record<string, any> | null) ?? null,
      createdAt: row.created_at.toISOString(),
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async listAssignments(opts: { limit: number; cursor: string | null }) {
    const rows = await this.prisma.assignments.findMany({
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
        status: true,
        due_date: true,
        created_at: true,
        published_at: true,
        title: true,
        therapist: { select: { id: true, full_name: true } },
        client: { select: { id: true, full_name: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: AdminAssignmentListItemDto[] = sliced.map((row) => ({
      id: row.id,
      status: row.status,
      dueDate: row.due_date ? row.due_date.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      title: row.title ?? null,
      therapistId: row.therapist.id,
      therapistName: row.therapist.full_name ?? null,
      clientId: row.client.id,
      clientName: row.client.full_name ?? null,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async listNotifications(opts: { limit: number; cursor: string | null }) {
    const rows = await this.prisma.notifications.findMany({
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
        user_id: true,
        type: true,
        read_at: true,
        created_at: true,
        data_cipher: true,
        user: { select: { email: true } },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: AdminNotificationItemDto[] = sliced.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user?.email ?? null,
      type: row.type,
      readAt: row.read_at ? row.read_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      hasPayload: Boolean(row.data_cipher),
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async listResponses(opts: { limit: number; cursor: string | null }) {
    const rows = await this.prisma.responses.findMany({
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
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items: AdminResponseItemDto[] = sliced.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      clientId: row.client_id,
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
}
