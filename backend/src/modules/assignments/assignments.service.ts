import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";

export type TherapistAssignmentListItemDto = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  status: "draft" | "published";
  publishedAt: string | null;
  title: string;
  description: string | null;
  client: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type TherapistAssignmentDetailDto = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  status: "draft" | "published";
  publishedAt: string | null;
  title: string;
  description: string | null;
  client: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type ClientAssignmentListItemDto = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  title: string;
  description: string | null;
  responseCount: number;
  lastSubmittedAt: string | null;
  lastReviewedAt: string | null;
};

export type ClientAssignmentDetailDto = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  title: string;
  description: string | null;
  responseCount: number;
};

@Injectable()
export class AssignmentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  async create(
    therapistUserId: string,
    dto: { clientId: string; promptId: string; dueDate?: string; recurrence?: string },
  ) {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    if (!dto?.clientId || typeof dto.clientId !== "string" || dto.clientId.trim().length === 0) {
      throw new BadRequestException("clientId is required");
    }
    if (!dto?.promptId || typeof dto.promptId !== "string" || dto.promptId.trim().length === 0) {
      throw new BadRequestException("promptId is required");
    }

    const client = await this.prisma.clients.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException("Client not found");

    // enforce ownership (client belongs to therapist)
    if ((client as any).therapist_id && (client as any).therapist_id !== therapist.id) {
      throw new ForbiddenException("Client does not belong to this therapist");
    }

    const prompt = await this.prisma.prompts.findUnique({
      where: { id: dto.promptId },
    });
    if (!prompt) throw new NotFoundException("Prompt not found");

    const created = await this.prisma.assignments.create({
      data: {
        therapist_id: therapist.id,
        client_id: client.id,
        prompt_id: prompt.id,
        title: prompt.title,
        description: prompt.content,
        status: "published",
        published_at: new Date(),
        due_date: dto.dueDate ? new Date(dto.dueDate) : null,
        recurrence: dto.recurrence || null,
      },
    });

    await this.audit.log({
      userId: therapistUserId,
      action: "assignment.create",
      entityType: "assignment",
      entityId: created.id,
      metadata: {
        clientId: client.id,
        status: "published",
        dueDate: dto.dueDate ?? null,
      },
    });

    return created;
  }

  // ✅ Client list: includes prompt + submission stats (recommended for UI)
  async listForClient(
    clientUserId: string,
    opts: { q: string | null; limit: number; cursor: string | null },
  ): Promise<{ items: ClientAssignmentListItemDto[]; nextCursor: string | null }> {
    const client = await this.prisma.clients.findFirst({
      where: { user_id: clientUserId },
    });
    if (!client) throw new ForbiddenException("Not a client");

    const where: Prisma.assignmentsWhereInput = {
      client_id: client.id,
      status: "published",
    };
    if (opts.q) {
      where.OR = [
        { title: { contains: opts.q, mode: "insensitive" } },
        { description: { contains: opts.q, mode: "insensitive" } },
        { prompt: { title: { contains: opts.q, mode: "insensitive" } } },
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
        due_date: true,
        created_at: true,
        title: true,
        description: true,
        prompt: { select: { title: true, content: true } },

        // stats
        _count: { select: { responses: true } },
        responses: {
          take: 1,
          orderBy: { created_at: "desc" },
          select: { created_at: true, reviewed_at: true },
        },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items = sliced.map((a): ClientAssignmentListItemDto => ({
      id: a.id,
      dueDate: a.due_date ? a.due_date.toISOString() : null,
      createdAt: a.created_at.toISOString(),
      title: a.title ?? a.prompt?.title ?? "Assignment",
      description: a.description ?? a.prompt?.content ?? null,
      responseCount: a._count.responses,
      lastSubmittedAt: a.responses[0]?.created_at
        ? a.responses[0].created_at.toISOString()
        : null,
      lastReviewedAt: a.responses[0]?.reviewed_at
        ? a.responses[0].reviewed_at.toISOString()
        : null,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  // ✅ Client assignment detail for /assignments/mine/:assignmentId
  async getClientAssignmentDetail(clientUserId: string, assignmentId: string) {
    const client = await this.prisma.clients.findFirst({
      where: { user_id: clientUserId },
    });
    if (!client) throw new ForbiddenException("Not a client");

    const a = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        due_date: true,
        created_at: true,
        client_id: true,
        status: true,
        title: true,
        description: true,
        prompt: { select: { title: true, content: true } },
        _count: { select: { responses: true } },
      },
    });

    if (!a) throw new NotFoundException("Assignment not found");
    if (a.client_id !== client.id) throw new ForbiddenException("Invalid assignment");
    if (a.status !== "published") throw new ForbiddenException("Assignment not published");

    return {
      id: a.id,
      dueDate: a.due_date ? a.due_date.toISOString() : null,
      createdAt: a.created_at.toISOString(),
      title: a.title ?? a.prompt?.title ?? "Assignment",
      description: a.description ?? a.prompt?.content ?? null,
      responseCount: a._count.responses,
    } as ClientAssignmentDetailDto;
  }

  async listForTherapist(
    therapistUserId: string,
    opts: { q: string | null; status: "draft" | "published" | null; limit: number; cursor: string | null },
  ): Promise<{ items: TherapistAssignmentListItemDto[]; nextCursor: string | null }> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const where: Prisma.assignmentsWhereInput = { therapist_id: therapist.id };
    if (opts.status) where.status = opts.status;
    if (opts.q) {
      where.OR = [
        { title: { contains: opts.q, mode: "insensitive" } },
        { description: { contains: opts.q, mode: "insensitive" } },
        { client: { full_name: { contains: opts.q, mode: "insensitive" } } },
        { client: { user: { email: { contains: opts.q, mode: "insensitive" } } } },
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
        due_date: true,
        created_at: true,
        status: true,
        published_at: true,
        title: true,
        description: true,
        prompt: { select: { title: true, content: true } },
        client: {
          select: {
            id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    const hasMore = rows.length > opts.limit;
    const sliced = hasMore ? rows.slice(0, opts.limit) : rows;

    const items = sliced.map((row) => ({
      id: row.id,
      dueDate: row.due_date ? row.due_date.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      status: row.status,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      title: row.title ?? row.prompt?.title ?? "Assignment",
      description: row.description ?? row.prompt?.content ?? null,
      client: {
        id: row.client.id,
        fullName: row.client.full_name,
        email: row.client.user.email,
      },
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async getForTherapist(
    therapistUserId: string,
    assignmentId: string,
  ): Promise<TherapistAssignmentDetailDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const row = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        due_date: true,
        created_at: true,
        status: true,
        published_at: true,
        title: true,
        description: true,
        prompt: { select: { title: true, content: true } },
        therapist_id: true,
        client: {
          select: {
            id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!row) throw new NotFoundException("Assignment not found");
    if (row.therapist_id !== therapist.id) throw new ForbiddenException("Not allowed");

    return {
      id: row.id,
      dueDate: row.due_date ? row.due_date.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      status: row.status,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      title: row.title ?? row.prompt?.title ?? "Assignment",
      description: row.description ?? row.prompt?.content ?? null,
      client: {
        id: row.client.id,
        fullName: row.client.full_name,
        email: row.client.user.email,
      },
    };
  }

  async createDraft(
    therapistUserId: string,
    dto: { clientId: string; title: string; description?: string; dueDate?: string },
  ): Promise<TherapistAssignmentDetailDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const client = await this.prisma.clients.findUnique({
      where: { id: dto.clientId },
      select: { id: true, therapist_id: true, full_name: true, user: { select: { email: true } } },
    });
    if (!client) throw new NotFoundException("Client not found");
    if (client.therapist_id !== therapist.id) {
      throw new ForbiddenException("Client does not belong to this therapist");
    }

    const created = await this.prisma.assignments.create({
      data: {
        therapist_id: therapist.id,
        client_id: client.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        due_date: dto.dueDate ? new Date(dto.dueDate) : null,
        status: "draft",
        published_at: null,
      },
      select: {
        id: true,
        due_date: true,
        created_at: true,
        status: true,
        published_at: true,
        title: true,
        description: true,
      },
    });

    await this.audit.log({
      userId: therapistUserId,
      action: "assignment.create",
      entityType: "assignment",
      entityId: created.id,
      metadata: {
        clientId: client.id,
        status: "draft",
        dueDate: dto.dueDate ?? null,
      },
    });

    return {
      id: created.id,
      dueDate: created.due_date ? created.due_date.toISOString() : null,
      createdAt: created.created_at.toISOString(),
      status: created.status,
      publishedAt: created.published_at ? created.published_at.toISOString() : null,
      title: created.title ?? "Assignment",
      description: created.description ?? null,
      client: {
        id: client.id,
        fullName: client.full_name,
        email: client.user.email,
      },
    };
  }

  async updateAssignment(
    therapistUserId: string,
    assignmentId: string,
    dto: { clientId?: string; title?: string; description?: string; dueDate?: string | null },
  ): Promise<TherapistAssignmentDetailDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const existing = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        therapist_id: true,
        client_id: true,
      },
    });
    if (!existing) throw new NotFoundException("Assignment not found");
    if (existing.therapist_id !== therapist.id) throw new ForbiddenException("Not allowed");

    let nextClientId = existing.client_id;
    let clientMeta: { id: string; full_name: string; user: { email: string } } | null = null;

    if (dto.clientId) {
      const client = await this.prisma.clients.findUnique({
        where: { id: dto.clientId },
        select: { id: true, therapist_id: true, full_name: true, user: { select: { email: true } } },
      });
      if (!client) throw new NotFoundException("Client not found");
      if (client.therapist_id !== therapist.id) {
        throw new ForbiddenException("Client does not belong to this therapist");
      }
      nextClientId = client.id;
      clientMeta = client;
    }

    const updated = await this.prisma.assignments.update({
      where: { id: assignmentId },
      data: {
        client_id: nextClientId,
        title: dto.title?.trim(),
        description:
          dto.description !== undefined ? dto.description.trim() || null : undefined,
        due_date:
          dto.dueDate === null || dto.dueDate === ""
            ? null
            : dto.dueDate
              ? new Date(dto.dueDate)
              : undefined,
      },
      select: {
        id: true,
        due_date: true,
        created_at: true,
        status: true,
        published_at: true,
        title: true,
        description: true,
        client: {
          select: { id: true, full_name: true, user: { select: { email: true } } },
        },
        prompt: { select: { title: true, content: true } },
      },
    });

    const client = clientMeta ?? updated.client;

    await this.audit.log({
      userId: therapistUserId,
      action: "assignment.update",
      entityType: "assignment",
      entityId: updated.id,
      metadata: {
        clientId: client.id,
        dueDate:
          dto.dueDate === undefined ? undefined : dto.dueDate === "" ? null : dto.dueDate,
      },
    });

    return {
      id: updated.id,
      dueDate: updated.due_date ? updated.due_date.toISOString() : null,
      createdAt: updated.created_at.toISOString(),
      status: updated.status,
      publishedAt: updated.published_at ? updated.published_at.toISOString() : null,
      title: updated.title ?? updated.prompt?.title ?? "Assignment",
      description: updated.description ?? updated.prompt?.content ?? null,
      client: {
        id: client.id,
        fullName: client.full_name,
        email: client.user.email,
      },
    };
  }

  async setPublished(
    therapistUserId: string,
    assignmentId: string,
    published: boolean,
  ): Promise<TherapistAssignmentDetailDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        therapist_id: true,
        status: true,
      },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.therapist_id !== therapist.id) throw new ForbiddenException("Not allowed");

    const updated = await this.prisma.assignments.update({
      where: { id: assignmentId },
      data: {
        status: published ? "published" : "draft",
        published_at: published ? new Date() : null,
      },
      select: {
        id: true,
        due_date: true,
        created_at: true,
        status: true,
        published_at: true,
        title: true,
        description: true,
        prompt: { select: { title: true, content: true } },
        client: {
          select: {
            id: true,
            user_id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (published && assignment.status !== "published") {
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      const title = updated.title ?? updated.prompt?.title ?? "Assignment";
      const dueDate = updated.due_date ? updated.due_date.toISOString() : null;
      const url = `${baseUrl}/app/client/assignments/${updated.id}`;

      await this.notifications.notifyUser({
        userId: updated.client.user_id,
        type: "assignment_published",
        dedupeKey: `assignment:${updated.id}:published`,
        payload: {
          kind: "assignment_published",
          title: "New check-in ready",
          body: `A new check-in "${title}" is ready when you are.`,
          url,
          assignmentId: updated.id,
          dueDate,
        },
        emailTo: updated.client.user.email,
        emailSubject: "New check-in ready",
        emailText: `A new check-in "${title}" is ready when you are. Open: ${url}`,
        emailHtml: `<p>A new check-in <strong>${title}</strong> is ready when you are.</p><p><a href="${url}">Open check-in</a></p>`,
      });
    }

    await this.audit.log({
      userId: therapistUserId,
      action: published ? "assignment.publish" : "assignment.unpublish",
      entityType: "assignment",
      entityId: updated.id,
      metadata: {
        status: updated.status,
        publishedAt: updated.published_at ? updated.published_at.toISOString() : null,
      },
    });

    return {
      id: updated.id,
      dueDate: updated.due_date ? updated.due_date.toISOString() : null,
      createdAt: updated.created_at.toISOString(),
      status: updated.status,
      publishedAt: updated.published_at ? updated.published_at.toISOString() : null,
      title: updated.title ?? updated.prompt?.title ?? "Assignment",
      description: updated.description ?? updated.prompt?.content ?? null,
      client: {
        id: updated.client.id,
        fullName: updated.client.full_name,
        email: updated.client.user.email,
      },
    };
  }

  async sendManualReminder(
    therapistUserId: string,
    assignmentId: string,
  ): Promise<{ ok: true }> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        therapist_id: true,
        status: true,
        due_date: true,
        title: true,
        prompt: { select: { title: true } },
        client: {
          select: {
            user_id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.therapist_id !== therapist.id) throw new ForbiddenException("Not allowed");
    if (assignment.status !== "published") {
      throw new BadRequestException("Assignment must be published to send reminders");
    }

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const title = assignment.title ?? assignment.prompt?.title ?? "Assignment";
    const dueDate = assignment.due_date ? assignment.due_date.toISOString() : null;
    const url = `${baseUrl}/app/client/assignments/${assignment.id}`;
    const dedupeKey = `assignment:${assignment.id}:manual:${new Date().toISOString().slice(0, 10)}`;

    await this.notifications.notifyUser({
      userId: assignment.client.user_id,
      type: "assignment_manual_reminder",
      dedupeKey,
      payload: {
        kind: "assignment_manual_reminder",
        title: "Gentle check-in reminder",
        body: `When you have a moment, your check-in "${title}" is ready.`,
        url,
        assignmentId: assignment.id,
        dueDate,
      },
      emailTo: assignment.client.user.email,
      emailSubject: "Gentle check-in reminder",
      emailText: `When you have a moment, your check-in "${title}" is ready. Open: ${url}`,
      emailHtml: `<p>When you have a moment, your check-in <strong>${title}</strong> is ready.</p><p><a href="${url}">Open check-in</a></p>`,
    });

    await this.audit.log({
      userId: therapistUserId,
      action: "assignment.reminder.manual",
      entityType: "assignment",
      entityId: assignment.id,
      metadata: { clientId: assignment.client.user_id, dueDate },
    });

    return { ok: true };
  }
}
