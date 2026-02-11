import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ResponseCompletionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AesGcm } from "../../common/crypto/aes-gcm";
import { AuditService } from "../audit/audit.service";

type ReviewedFilter = "all" | "reviewed" | "unreviewed";
type FlaggedFilter = "all" | "flagged" | "unflagged";

export type SubmitResponseResultDto = {
  id: string;
  assignmentId: string;
  clientId: string;
  voiceStorageKey: string | null;
  createdAt: string;
};

export type ResponseTimelineItemDto = {
  id: string;
  createdAt: string | null;
  mood: number;
  reviewedAt: string | null;
  flaggedAt: string | null;
  starredAt: string | null;
};

export type TherapistResponseListItemDto = {
  id: string;
  assignmentId: string;
  clientId: string;
  voiceStorageKey: string | null;
  createdAt: string | null;
  mood: number;
  reviewedAt: string | null;
  reviewedById: string | null;
  flaggedAt: string | null;
  starredAt: string | null;
  lastAccessedAt: string | null;
  hasTherapistNote: boolean;
  feedbackCount: number;
  promptPresent: boolean;
  recentResponses: ResponseTimelineItemDto[];
  client: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type TherapistResponseListDto = {
  items: TherapistResponseListItemDto[];
  nextCursor: string | null;
};

export type TherapistDecryptedResponseDto = {
  id: string;
  assignmentId: string;
  clientId: string;
  voiceStorageKey: string | null;
  createdAt: string | null;
  mood: number;
  reviewedAt: string | null;
  reviewedById: string | null;
  flaggedAt: string | null;
  starredAt: string | null;
  lastAccessedAt: string | null;
  therapistNote: string | null;
  client: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  text: string;
  prompt: string | null;
};

export type TherapistReviewResultDto = {
  id: string;
  reviewedAt: string | null;
  reviewedById: string | null;
  flaggedAt: string | null;
  starredAt: string | null;
};

export type TherapistFlagResultDto = {
  id: string;
  flaggedAt: string | null;
};

export type TherapistStarResultDto = {
  id: string;
  starredAt: string | null;
};

export type ClientResponseListItemDto = {
  id: string;
  assignmentId: string;
  createdAt: string | null;
  reviewedAt: string | null;
  flaggedAt: string | null;
  mood: number;
};

@Injectable()
export class ResponsesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Client submits encrypted response
  async submit(
    userId: string,
    dto: {
      assignmentId: string;
      text: string;
      mood: number;
      prompt?: string;
      voiceKey?: string;
      completionStatus?: "partial" | "completed";
    },
  ): Promise<SubmitResponseResultDto> {
    const client = await this.prisma.clients.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });
    if (!client) throw new ForbiddenException("Not a client");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: dto.assignmentId },
      select: { id: true, client_id: true, status: true },
    });

    if (!assignment || assignment.client_id !== client.id) {
      throw new ForbiddenException("Invalid assignment");
    }
    if (assignment.status !== "published") {
      throw new ForbiddenException("Assignment not published");
    }

    const aes = AesGcm.fromEnv();
    const enc = aes.encrypt(dto.text);
    const promptTrimmed = dto.prompt?.trim();
    const promptEnc = promptTrimmed ? aes.encrypt(promptTrimmed) : null;

    const completionStatus =
      dto.completionStatus?.toLowerCase() === "partial"
        ? ResponseCompletionStatus.PARTIAL
        : ResponseCompletionStatus.COMPLETED;

    const created = await this.prisma.responses.create({
      data: {
        assignment_id: assignment.id,
        client_id: client.id,
        mood: dto.mood,
        completion_status: completionStatus,
        text_cipher: enc.cipher,
        text_nonce: enc.nonce,
        text_tag: enc.tag,
        prompt_cipher: promptEnc?.cipher ?? null,
        prompt_nonce: promptEnc?.nonce ?? null,
        prompt_tag: promptEnc?.tag ?? null,
        voice_storage_key: dto.voiceKey || null,
      },
      select: {
        id: true,
        assignment_id: true,
        client_id: true,
        voice_storage_key: true,
        created_at: true,
      },
    });

    return {
      id: created.id,
      assignmentId: created.assignment_id,
      clientId: created.client_id,
      voiceStorageKey: created.voice_storage_key ?? null,
      createdAt: created.created_at?.toISOString?.() ?? created.created_at,
    };
  }

  // Therapist lists responses for an assignment (NO decrypt)
  // Supports filters + cursor pagination
  async listForTherapistAssignment(
    therapistUserId: string,
    assignmentId: string,
    opts: {
      q: string | null;
      clientId: string | null;
      reviewed: ReviewedFilter;
      flagged: FlaggedFilter;
      take: number;
      cursor: string | null;
    },
  ): Promise<TherapistResponseListDto> {
    // find therapist id
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    // verify therapist owns assignment
    const assignment = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: { id: true, therapist_id: true },
    });
    if (!assignment || assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException("Assignment not owned by therapist");
    }

    const where: Prisma.responsesWhereInput = { assignment_id: assignmentId };
    if (opts.clientId) {
      where.client_id = opts.clientId;
    }

    // reviewed filter
    if (opts.reviewed === "reviewed") where.reviewed_at = { not: null };
    if (opts.reviewed === "unreviewed") where.reviewed_at = null;

    // flagged filter
    if (opts.flagged === "flagged") where.flagged_at = { not: null };
    if (opts.flagged === "unflagged") where.flagged_at = null;

    if (opts.q) {
      where.client = {
        OR: [
          { full_name: { contains: opts.q, mode: "insensitive" } },
          { user: { email: { contains: opts.q, mode: "insensitive" } } },
        ],
      };
    }

    const take = opts.take;

    // ✅ IMPORTANT: orderBy must match the cursor field for stable pagination
    const rows = await this.prisma.responses.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: take + 1,
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
        voice_storage_key: true,
        created_at: true,
        mood: true,

        reviewed_at: true,
        reviewed_by_id: true,
        flagged_at: true,
        starred_at: true,

        // We do NOT decrypt note here; just indicate presence for UI badge
        therapist_note_cipher: true,
        prompt_cipher: true,

        client: {
          select: {
            id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;

    const ids = sliced.map((r) => r.id);
    const clientIds = Array.from(new Set(sliced.map((r) => r.client_id)));

    const feedbackCounts = ids.length
      ? await this.prisma.feedback.groupBy({
          by: ["response_id"],
          where: { response_id: { in: ids } },
          _count: { response_id: true },
        })
      : [];
    const feedbackMap = new Map(
      feedbackCounts.map((row) => [row.response_id, row._count.response_id]),
    );

    const accessRows = ids.length
      ? await this.prisma.audit_logs.findMany({
          where: {
            action: "response.decrypt.view",
            entity_type: "response",
            entity_id: { in: ids },
          },
          orderBy: { created_at: "desc" },
          select: { entity_id: true, created_at: true },
        })
      : [];

    const lastAccessById = new Map<string, string>();
    for (const row of accessRows) {
      if (!row.entity_id) continue;
      if (!lastAccessById.has(row.entity_id)) {
        lastAccessById.set(row.entity_id, row.created_at.toISOString());
      }
    }

    const timelineRows = clientIds.length
      ? await this.prisma.responses.findMany({
          where: { assignment_id: assignmentId, client_id: { in: clientIds } },
          orderBy: { created_at: "desc" },
          select: {
            id: true,
            client_id: true,
            created_at: true,
            mood: true,
            reviewed_at: true,
            flagged_at: true,
            starred_at: true,
          },
        })
      : [];

    const timelineByClient = new Map<string, ResponseTimelineItemDto[]>();
    for (const row of timelineRows) {
      const list = timelineByClient.get(row.client_id) ?? [];
      if (list.length >= 3) continue;
      list.push({
        id: row.id,
        createdAt: row.created_at ? row.created_at.toISOString() : null,
        mood: row.mood,
        reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
        flaggedAt: row.flagged_at ? row.flagged_at.toISOString() : null,
        starredAt: row.starred_at ? row.starred_at.toISOString() : null,
      });
      timelineByClient.set(row.client_id, list);
    }

    const items = sliced.map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      clientId: r.client_id,
      voiceStorageKey: r.voice_storage_key ?? null,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      mood: r.mood,

      reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null,
      reviewedById: r.reviewed_by_id ?? null,
      flaggedAt: r.flagged_at ? r.flagged_at.toISOString() : null,
      starredAt: r.starred_at ? r.starred_at.toISOString() : null,
      lastAccessedAt: lastAccessById.get(r.id) ?? null,

      hasTherapistNote: Boolean(r.therapist_note_cipher),
      feedbackCount: feedbackMap.get(r.id) ?? 0,
      promptPresent: Boolean(r.prompt_cipher),
      recentResponses: timelineByClient.get(r.client_id) ?? [],

      client: r.client
        ? {
            id: r.client.id,
            fullName: r.client.full_name ?? "",
            email: r.client.user?.email ?? "",
          }
        : null,
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  // Therapist decrypts a single response (and therapist note if present)
  async decryptForTherapist(
    therapistUserId: string,
    responseId: string,
  ): Promise<TherapistDecryptedResponseDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const resp = await this.prisma.responses.findUnique({
      where: { id: responseId },
      include: {
        client: {
          select: {
            id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!resp) throw new NotFoundException("Response not found");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: resp.assignment_id },
      select: { id: true, therapist_id: true },
    });
    if (!assignment || assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException("Not allowed to view this response");
    }

    await this.audit.log({
      userId: therapistUserId,
      action: "response.decrypt.view",
      entityType: "response",
      entityId: resp.id,
      metadata: { assignmentId: resp.assignment_id, clientId: resp.client_id },
    });

    const aes = AesGcm.fromEnv();
    const text = aes.decrypt(resp.text_cipher, resp.text_nonce, resp.text_tag);

    let prompt: string | null = null;
    if (resp.prompt_cipher && resp.prompt_nonce && resp.prompt_tag) {
      prompt = aes.decrypt(resp.prompt_cipher, resp.prompt_nonce, resp.prompt_tag);
    }

    let therapistNote: string | null = null;
    if (resp.therapist_note_cipher && resp.therapist_note_nonce && resp.therapist_note_tag) {
      therapistNote = aes.decrypt(
        resp.therapist_note_cipher,
        resp.therapist_note_nonce,
        resp.therapist_note_tag,
      );
    }

    return {
      id: resp.id,
      assignmentId: resp.assignment_id,
      clientId: resp.client_id,
      createdAt: resp.created_at ? resp.created_at.toISOString() : null,
      voiceStorageKey: resp.voice_storage_key ?? null,
      mood: resp.mood,

      reviewedAt: resp.reviewed_at ? resp.reviewed_at.toISOString() : null,
      reviewedById: resp.reviewed_by_id ?? null,
      flaggedAt: resp.flagged_at ? resp.flagged_at.toISOString() : null,
      starredAt: resp.starred_at ? resp.starred_at.toISOString() : null,
      lastAccessedAt: new Date().toISOString(),

      therapistNote,

      client: resp.client
        ? {
            id: resp.client.id,
            fullName: resp.client.full_name ?? "",
            email: resp.client.user?.email ?? "",
          }
        : null,

      text,
      prompt,
    };
  }

  // Therapist: mark reviewed + optional encrypted note
  async markReviewed(
    therapistUserId: string,
    responseId: string,
    therapistNote?: string,
  ): Promise<TherapistReviewResultDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const resp = await this.prisma.responses.findUnique({
      where: { id: responseId },
      select: { id: true, assignment_id: true },
    });
    if (!resp) throw new NotFoundException("Response not found");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: resp.assignment_id },
      select: { therapist_id: true },
    });
    if (!assignment || assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException("Not allowed");
    }

    const data: Prisma.responsesUpdateInput = {
      reviewed_at: new Date(),
      reviewed_by: { connect: { id: therapist.id } },
    };

    // undefined => don't change note
    // empty string => clear note
    // non-empty => encrypt + save
    if (therapistNote !== undefined) {
      const trimmed = therapistNote.trim();

      if (!trimmed) {
        data.therapist_note_cipher = null;
        data.therapist_note_nonce = null;
        data.therapist_note_tag = null;
      } else {
        const aes = AesGcm.fromEnv();
        const enc = aes.encrypt(trimmed);
        data.therapist_note_cipher = enc.cipher;
        data.therapist_note_nonce = enc.nonce;
        data.therapist_note_tag = enc.tag;
      }
    }

    const updated = await this.prisma.responses.update({
      where: { id: responseId },
      data,
      select: {
        id: true,
        reviewed_at: true,
        reviewed_by_id: true,
        flagged_at: true,
        starred_at: true,
        assignment_id: true,
        client_id: true,
      },
    });

    await this.audit.log({
      userId: therapistUserId,
      action: "response.review",
      entityType: "response",
      entityId: updated.id,
      metadata: { assignmentId: updated.assignment_id, clientId: updated.client_id },
    });

    if (therapistNote !== undefined) {
      await this.audit.log({
        userId: therapistUserId,
        action: "response.note.update",
        entityType: "response",
        entityId: updated.id,
        metadata: { assignmentId: updated.assignment_id, clientId: updated.client_id },
      });
    }

    return {
      id: updated.id,
      reviewedAt: updated.reviewed_at ? updated.reviewed_at.toISOString() : null,
      reviewedById: updated.reviewed_by_id ?? null,
      flaggedAt: updated.flagged_at ? updated.flagged_at.toISOString() : null,
      starredAt: updated.starred_at ? updated.starred_at.toISOString() : null,
    };
  }

  // Therapist: update private note without marking reviewed
  async updateTherapistNote(
    therapistUserId: string,
    responseId: string,
    therapistNote?: string,
  ): Promise<{ id: string; hasNote: boolean }> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const resp = await this.prisma.responses.findUnique({
      where: { id: responseId },
      select: { id: true, assignment_id: true },
    });
    if (!resp) throw new NotFoundException("Response not found");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: resp.assignment_id },
      select: { therapist_id: true },
    });
    if (!assignment || assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException("Not allowed");
    }

    const data: Prisma.responsesUpdateInput = {};

    if (therapistNote !== undefined) {
      const trimmed = therapistNote.trim();
      if (!trimmed) {
        data.therapist_note_cipher = null;
        data.therapist_note_nonce = null;
        data.therapist_note_tag = null;
      } else {
        const aes = AesGcm.fromEnv();
        const enc = aes.encrypt(trimmed);
        data.therapist_note_cipher = enc.cipher;
        data.therapist_note_nonce = enc.nonce;
        data.therapist_note_tag = enc.tag;
      }
    }

    const updated = await this.prisma.responses.update({
      where: { id: responseId },
      data,
      select: {
        id: true,
        therapist_note_cipher: true,
        assignment_id: true,
        client_id: true,
      },
    });

    await this.audit.log({
      userId: therapistUserId,
      action: "response.note.update",
      entityType: "response",
      entityId: updated.id,
      metadata: { assignmentId: updated.assignment_id, clientId: updated.client_id },
    });

    return { id: updated.id, hasNote: Boolean(updated.therapist_note_cipher) };
  }

  // Therapist: toggle flag
  async toggleFlag(
    therapistUserId: string,
    responseId: string,
  ): Promise<TherapistFlagResultDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const resp = await this.prisma.responses.findUnique({
      where: { id: responseId },
      select: { id: true, assignment_id: true, flagged_at: true },
    });
    if (!resp) throw new NotFoundException("Response not found");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: resp.assignment_id },
      select: { therapist_id: true },
    });
    if (!assignment || assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException("Not allowed");
    }

    const nextFlaggedAt = resp.flagged_at ? null : new Date();

    const updated = await this.prisma.responses.update({
      where: { id: responseId },
      data: { flagged_at: nextFlaggedAt },
      select: { id: true, flagged_at: true, assignment_id: true, client_id: true },
    });

    await this.audit.log({
      userId: therapistUserId,
      action: "response.flag",
      entityType: "response",
      entityId: updated.id,
      metadata: {
        assignmentId: updated.assignment_id,
        clientId: updated.client_id,
        flagged: Boolean(updated.flagged_at),
      },
    });

    return {
      id: updated.id,
      flaggedAt: updated.flagged_at ? updated.flagged_at.toISOString() : null,
    };
  }

  // Therapist: toggle star
  async toggleStar(
    therapistUserId: string,
    responseId: string,
  ): Promise<TherapistStarResultDto> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const resp = await this.prisma.responses.findUnique({
      where: { id: responseId },
      select: { id: true, assignment_id: true, starred_at: true },
    });
    if (!resp) throw new NotFoundException("Response not found");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: resp.assignment_id },
      select: { therapist_id: true },
    });
    if (!assignment || assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException("Not allowed");
    }

    const nextStarredAt = resp.starred_at ? null : new Date();

    const updated = await this.prisma.responses.update({
      where: { id: responseId },
      data: {
        starred_at: nextStarredAt,
        starred_by: nextStarredAt ? { connect: { id: therapist.id } } : { disconnect: true },
      },
      select: {
        id: true,
        starred_at: true,
        assignment_id: true,
        client_id: true,
      },
    });

    await this.audit.log({
      userId: therapistUserId,
      action: "response.star",
      entityType: "response",
      entityId: updated.id,
      metadata: {
        assignmentId: updated.assignment_id,
        clientId: updated.client_id,
        starred: Boolean(updated.starred_at),
      },
    });

    return {
      id: updated.id,
      starredAt: updated.starred_at ? updated.starred_at.toISOString() : null,
    };
  }

  // Client: list my responses for an assignment
  async listForClientAssignment(
    clientUserId: string,
    assignmentId: string,
  ): Promise<ClientResponseListItemDto[]> {
    const client = await this.prisma.clients.findFirst({
      where: { user_id: clientUserId },
      select: { id: true },
    });
    if (!client) throw new ForbiddenException("Not a client");

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: { id: true, client_id: true },
    });
    if (!assignment || assignment.client_id !== client.id) {
      throw new ForbiddenException("Invalid assignment");
    }

    const rows = await this.prisma.responses.findMany({
      where: { assignment_id: assignmentId, client_id: client.id },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        assignment_id: true,
        created_at: true,
        reviewed_at: true,
        flagged_at: true,
        mood: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      flaggedAt: row.flagged_at ? row.flagged_at.toISOString() : null,
      mood: row.mood,
    }));
  }
}
