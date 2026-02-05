import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LibraryItemStatus, Prisma, UserRole } from "@prisma/client";
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
  librarySource: {
    itemId: string;
    versionId: string | null;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
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
  librarySource: {
    itemId: string;
    versionId: string | null;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
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
  librarySource: {
    itemId: string;
    versionId: string | null;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
};

export type ClientAssignmentDetailDto = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  title: string;
  description: string | null;
  responseCount: number;
  librarySource: {
    itemId: string;
    versionId: string | null;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
};

export type AssignmentListRowDto = {
  id: string;
  dueDate: string | null;
  createdAt: string;
  status: "draft" | "published";
  publishedAt: string | null;
  title: string;
  description: string | null;
  clientId: string;
  therapistId: string;
  librarySource: {
    itemId: string;
    versionId: string | null;
    version: number | null;
    title: string | null;
    slug: string | null;
    contentType: string | null;
  } | null;
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
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,

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
      librarySource: a.library_item_id
        ? {
            itemId: a.library_item_id,
            versionId: a.library_item_version_id ?? null,
            version: a.library_item_version ?? null,
            title: a.library_source_title ?? null,
            slug: a.library_source_slug ?? null,
            contentType: a.library_source_content_type ?? null,
          }
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
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,
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
      librarySource: a.library_item_id
        ? {
            itemId: a.library_item_id,
            versionId: a.library_item_version_id ?? null,
            version: a.library_item_version ?? null,
            title: a.library_source_title ?? null,
            slug: a.library_source_slug ?? null,
            contentType: a.library_source_content_type ?? null,
          }
        : null,
    } as ClientAssignmentDetailDto;
  }

  async listForTherapist(
    therapistUserId: string,
    opts: {
      q: string | null;
      clientId: string | null;
      status: "draft" | "published" | null;
      limit: number;
      cursor: string | null;
    },
  ): Promise<{ items: TherapistAssignmentListItemDto[]; nextCursor: string | null }> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const where: Prisma.assignmentsWhereInput = { therapist_id: therapist.id };
    if (opts.status) where.status = opts.status;
    if (opts.clientId) where.client_id = opts.clientId;
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
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,
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
      librarySource: row.library_item_id
        ? {
            itemId: row.library_item_id,
            versionId: row.library_item_version_id ?? null,
            version: row.library_item_version ?? null,
            title: row.library_source_title ?? null,
            slug: row.library_source_slug ?? null,
            contentType: row.library_source_content_type ?? null,
          }
        : null,
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
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,
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
      librarySource: row.library_item_id
        ? {
            itemId: row.library_item_id,
            versionId: row.library_item_version_id ?? null,
            version: row.library_item_version ?? null,
            title: row.library_source_title ?? null,
            slug: row.library_source_slug ?? null,
            contentType: row.library_source_content_type ?? null,
          }
        : null,
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
      librarySource: null,
    };
  }

  private extractClientSections(raw: unknown): Array<{ heading: string; text: string }> {
    const sections = Array.isArray(raw)
      ? (raw as any[])
      : raw && typeof raw === "object" && Array.isArray((raw as any).sections)
        ? ((raw as any).sections as any[])
        : [];

    return sections
      .filter((s) => String(s?.audience ?? "").trim().toLowerCase() === "client")
      .map((s) => ({
        heading:
          String(s?.title ?? "").trim() ||
          String(s?.headingPath ?? "").trim() ||
          "Section",
        text: String(s?.text ?? ""),
      }))
      .filter((s) => s.text.trim().length > 0);
  }

  private buildClientDescriptionFromLibrary(params: {
    itemTitle: string;
    note: string | null;
    clientSections: Array<{ heading: string; text: string }>;
  }) {
    const lines: string[] = [];
    if (params.note) {
      lines.push(`Note from clinician: ${params.note.trim()}`);
      lines.push("");
    }
    lines.push(params.itemTitle);
    lines.push("");
    for (const section of params.clientSections) {
      lines.push(section.heading);
      lines.push(section.text.trim());
      lines.push("");
    }
    return lines.join("\n").trim() || null;
  }

  async createFromLibrary(
    userId: string,
    role: UserRole,
    dto: {
      clinicId?: string | null;
      clientId: string;
      libraryItemId: string;
      libraryItemVersionId?: string | null;
      dueDate?: string | null;
      note?: string | null;
      program?: string | null;
      assignmentTitleOverride?: string | null;
    },
  ) {
    // Resolve clinic + therapist context.
    let clinicId: string;
    let therapistId: string | null = null;

    if (role === UserRole.admin) {
      if (!dto.clinicId) throw new BadRequestException("clinicId is required for admin requests");
      clinicId = dto.clinicId;
    } else if (role === UserRole.CLINIC_ADMIN) {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: userId },
      });
      if (!membership) throw new ForbiddenException("Clinic membership required");
      clinicId = membership.clinic_id;
      if (dto.clinicId && dto.clinicId !== clinicId) {
        throw new ForbiddenException("Invalid clinic");
      }
    } else {
      const therapist = await this.prisma.therapists.findFirst({
        where: { user_id: userId },
        select: { id: true, clinic_id: true },
      });
      if (!therapist?.clinic_id) throw new ForbiddenException("Not a therapist");
      clinicId = therapist.clinic_id;
      therapistId = therapist.id;
      if (dto.clinicId && dto.clinicId !== clinicId) {
        throw new ForbiddenException("Invalid clinic");
      }
    }

    // Client must belong to clinic.
    const client = await this.prisma.clients.findUnique({
      where: { id: dto.clientId },
      select: { id: true, therapist_id: true, therapist: { select: { clinic_id: true } } },
    });
    if (!client) throw new NotFoundException("Client not found");
    if (client.therapist?.clinic_id !== clinicId) {
      throw new ForbiddenException("Client does not belong to clinic");
    }
    if (role === UserRole.therapist && therapistId && client.therapist_id !== therapistId) {
      throw new ForbiddenException("Client does not belong to this therapist");
    }

    // Library item must be published and belong to clinic.
    const item = await this.prisma.library_items.findFirst({
      where: { id: dto.libraryItemId, clinic_id: clinicId, status: LibraryItemStatus.PUBLISHED },
      select: { id: true, title: true, slug: true, content_type: true, status: true, version: true },
    });
    if (!item) throw new NotFoundException("Library item not found (or not published)");

    const versionRow = dto.libraryItemVersionId
      ? await this.prisma.library_item_versions.findFirst({
          where: { id: dto.libraryItemVersionId, item_id: item.id },
          select: { id: true, version_number: true, sections_snapshot: true },
        })
      : await this.prisma.library_item_versions.findFirst({
          where: { item_id: item.id, version_number: item.version },
          select: { id: true, version_number: true, sections_snapshot: true },
        });
    if (!versionRow) {
      throw new BadRequestException("Library item version not found");
    }

    const clientSections = this.extractClientSections(versionRow.sections_snapshot);
    if (clientSections.length === 0) {
      throw new BadRequestException("Library item has no client-safe sections");
    }

    const title =
      dto.assignmentTitleOverride?.trim() ||
      item.title;

    const description = this.buildClientDescriptionFromLibrary({
      itemTitle: item.title,
      note: dto.note?.trim() || null,
      clientSections,
    });

    // Assignments are published immediately so the client can complete them.
    const created = await this.prisma.assignments.create({
      data: {
        therapist_id: therapistId ?? client.therapist_id,
        client_id: client.id,
        prompt_id: null,
        title,
        description,
        status: "published",
        published_at: new Date(),
        due_date: dto.dueDate ? new Date(dto.dueDate) : null,
        recurrence: null,
        library_item_id: item.id,
        library_item_version_id: versionRow.id,
        library_item_version: versionRow.version_number,
        library_source_title: item.title,
        library_source_slug: item.slug,
        library_source_content_type: item.content_type,
      },
      select: {
        id: true,
        due_date: true,
        created_at: true,
        status: true,
        published_at: true,
        title: true,
        description: true,
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,
        therapist_id: true,
        client_id: true,
      },
    });

    await this.audit.log({
      userId,
      action: "assignment.create_from_library",
      entityType: "assignment",
      entityId: created.id,
      metadata: {
        clinicId,
        clientId: client.id,
        libraryItemId: item.id,
        libraryItemVersionId: versionRow.id,
        libraryItemVersion: versionRow.version_number,
        dueDate: dto.dueDate ?? null,
        program: dto.program ?? null,
      },
    });

    return {
      id: created.id,
      status: created.status,
      publishedAt: created.published_at ? created.published_at.toISOString() : null,
      dueDate: created.due_date ? created.due_date.toISOString().slice(0, 10) : null,
      title: created.title ?? null,
      library_source: created.library_item_id
        ? {
            item_id: created.library_item_id,
            version_id: created.library_item_version_id ?? null,
            version: created.library_item_version ?? null,
            title: created.library_source_title ?? null,
            slug: created.library_source_slug ?? null,
            content_type: created.library_source_content_type ?? null,
            status: "PUBLISHED" as const,
          }
        : null,
    };
  }

  async listAssignments(
    userId: string,
    role: UserRole,
    opts: { clinicId: string | null; clientId: string | null; status: string | null; limit: number },
  ): Promise<{ items: AssignmentListRowDto[] }> {
    let clinicId: string;
    let therapistId: string | null = null;
    if (role === UserRole.admin) {
      if (!opts.clinicId) throw new BadRequestException("clinicId is required for admin requests");
      clinicId = opts.clinicId;
    } else if (role === UserRole.CLINIC_ADMIN) {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: userId },
      });
      if (!membership) throw new ForbiddenException("Clinic membership required");
      clinicId = membership.clinic_id;
    } else {
      const therapist = await this.prisma.therapists.findFirst({
        where: { user_id: userId },
        select: { id: true, clinic_id: true },
      });
      if (!therapist?.clinic_id) throw new ForbiddenException("Not a therapist");
      clinicId = therapist.clinic_id;
      therapistId = therapist.id;
    }

    const normalizedStatus = opts.status === "active" || opts.status === "completed" || opts.status === "all" ? opts.status : "all";

    const where: Prisma.assignmentsWhereInput = {
      therapist: { clinic_id: clinicId },
    };
    if (opts.clientId) where.client_id = opts.clientId;
    if (role === UserRole.therapist && therapistId) where.therapist_id = therapistId;

    const rows = await this.prisma.assignments.findMany({
      where,
      take: opts.limit,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      select: {
        id: true,
        due_date: true,
        created_at: true,
        status: true,
        published_at: true,
        title: true,
        description: true,
        therapist_id: true,
        client_id: true,
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,
        _count: { select: { responses: true } },
      },
    });

    const filtered = normalizedStatus === "all"
      ? rows
      : normalizedStatus === "completed"
        ? rows.filter((r) => (r._count.responses ?? 0) > 0)
        : rows.filter((r) => (r._count.responses ?? 0) === 0);

    return {
      items: filtered.map((row) => ({
        id: row.id,
        dueDate: row.due_date ? row.due_date.toISOString() : null,
        createdAt: row.created_at.toISOString(),
        status: row.status,
        publishedAt: row.published_at ? row.published_at.toISOString() : null,
        title: row.title ?? "Assignment",
        description: row.description ?? null,
        clientId: row.client_id,
        therapistId: row.therapist_id,
        librarySource: row.library_item_id
          ? {
              itemId: row.library_item_id,
              versionId: row.library_item_version_id ?? null,
              version: row.library_item_version ?? null,
              title: row.library_source_title ?? null,
              slug: row.library_source_slug ?? null,
              contentType: row.library_source_content_type ?? null,
            }
          : null,
      })),
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
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,
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
      librarySource: updated.library_item_id
        ? {
            itemId: updated.library_item_id,
            versionId: updated.library_item_version_id ?? null,
            version: updated.library_item_version ?? null,
            title: updated.library_source_title ?? null,
            slug: updated.library_source_slug ?? null,
            contentType: updated.library_source_content_type ?? null,
          }
        : null,
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
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_source_content_type: true,
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
      librarySource: updated.library_item_id
        ? {
            itemId: updated.library_item_id,
            versionId: updated.library_item_version_id ?? null,
            version: updated.library_item_version ?? null,
            title: updated.library_source_title ?? null,
            slug: updated.library_source_slug ?? null,
            contentType: updated.library_source_content_type ?? null,
          }
        : null,
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
