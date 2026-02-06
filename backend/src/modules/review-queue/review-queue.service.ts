import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ResponsesService } from "../responses/responses.service";

export type ReviewQueueItemDto = {
  id: string;
  assignmentId: string;
  assignmentTitle: string | null;
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  therapistName: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
  flaggedAt: string | null;
  hasTherapistNote: boolean;
  feedbackCount: number;
};

export type ReviewQueueListDto = {
  items: ReviewQueueItemDto[];
  nextCursor: string | null;
};

type ReviewedFilter = "all" | "reviewed" | "unreviewed";

type FlaggedFilter = "all" | "flagged" | "unflagged";

@Injectable()
export class ReviewQueueService {
  constructor(
    private prisma: PrismaService,
    private responses: ResponsesService,
  ) {}

  private async resolveClinicContext(params: {
    userId: string;
    role: UserRole;
    clinicId?: string | null;
  }) {
    if (params.role === UserRole.admin) {
      if (!params.clinicId) {
        throw new BadRequestException("clinicId is required for admin review queue");
      }
      const clinic = await this.prisma.clinics.findUnique({
        where: { id: params.clinicId },
        select: { id: true },
      });
      if (!clinic) throw new NotFoundException("Clinic not found");
      return { clinicId: clinic.id, therapistId: null };
    }

    if (params.role === UserRole.CLINIC_ADMIN) {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: params.userId },
        select: { clinic_id: true },
      });
      if (!membership) throw new ForbiddenException("Clinic membership required");
      return { clinicId: membership.clinic_id, therapistId: null };
    }

    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: params.userId },
      select: { id: true, clinic_id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");
    if (!therapist.clinic_id) throw new ForbiddenException("Clinic membership required");

    return { clinicId: therapist.clinic_id, therapistId: therapist.id };
  }

  async list(params: {
    userId: string;
    role: UserRole;
    clinicId?: string | null;
    q?: string | null;
    reviewed?: ReviewedFilter;
    flagged?: FlaggedFilter;
    limit?: number;
  }): Promise<ReviewQueueListDto> {
    const { clinicId, therapistId } = await this.resolveClinicContext({
      userId: params.userId,
      role: params.role,
      clinicId: params.clinicId ?? null,
    });

    const reviewed = params.reviewed ?? "all";
    const flagged = params.flagged ?? "all";
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 200);

    const where: Prisma.responsesWhereInput = {
      assignment: {
        therapist: { clinic_id: clinicId },
      },
    };

    if (therapistId) {
      where.assignment = { therapist_id: therapistId };
    }

    if (reviewed === "reviewed") where.reviewed_at = { not: null };
    if (reviewed === "unreviewed") where.reviewed_at = null;

    if (flagged === "flagged") where.flagged_at = { not: null };
    if (flagged === "unflagged") where.flagged_at = null;

    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { client: { full_name: { contains: q, mode: "insensitive" } } },
        { client: { user: { email: { contains: q, mode: "insensitive" } } } },
        { assignment: { title: { contains: q, mode: "insensitive" } } },
      ];
    }

    const rows = await this.prisma.responses.findMany({
      where,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      take: limit,
      select: {
        id: true,
        created_at: true,
        reviewed_at: true,
        flagged_at: true,
        therapist_note_cipher: true,
        assignment: {
          select: {
            id: true,
            title: true,
            therapist: { select: { full_name: true } },
          },
        },
        client: {
          select: {
            id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
        _count: { select: { feedback: true } },
      },
    });

    const items: ReviewQueueItemDto[] = rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignment.id,
      assignmentTitle: row.assignment.title ?? null,
      clientId: row.client.id,
      clientName: row.client.full_name ?? null,
      clientEmail: row.client.user?.email ?? null,
      therapistName: row.assignment.therapist?.full_name ?? null,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      flaggedAt: row.flagged_at ? row.flagged_at.toISOString() : null,
      hasTherapistNote: Boolean(row.therapist_note_cipher),
      feedbackCount: row._count.feedback,
    }));

    items.sort((a, b) => {
      const aNeeds = a.reviewedAt ? 1 : 0;
      const bNeeds = b.reviewedAt ? 1 : 0;
      if (aNeeds !== bNeeds) return aNeeds - bNeeds;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return a.id.localeCompare(b.id);
    });

    return { items, nextCursor: null };
  }

  async markReviewed(params: {
    userId: string;
    role: UserRole;
    responseIds: string[];
    therapistNote?: string | null;
  }) {
    if (params.role !== UserRole.therapist) {
      throw new ForbiddenException("Only therapists can mark reviewed");
    }

    const ids = Array.from(new Set(params.responseIds)).filter(Boolean);
    if (ids.length === 0) {
      throw new BadRequestException("responseIds are required");
    }

    const updated = [] as Array<{ id: string; reviewedAt: string | null }>;
    for (const responseId of ids) {
      const result = await this.responses.markReviewed(
        params.userId,
        responseId,
        params.therapistNote ?? undefined,
      );
      updated.push({ id: result.id, reviewedAt: result.reviewedAt });
    }

    return { ok: true, updated };
  }
}
