import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { buildDateRangeFromParts, formatDateOnly, parseDateOnly } from "../../reports/aer/aer-report.utils";

type TraceReason = "UNREVIEWED" | "NO_RESPONSE" | "OUT_OF_PERIOD" | "NOT_AVAILABLE";

export type TraceRow = {
  assignment_id: string;
  assignment_title: string | null;
  library_source: {
    item_id: string;
    version_id: string | null;
    version: number | null;
    title: string | null;
    slug: string | null;
  } | null;
  response: {
    response_id: string | null;
    submitted_at: string | null;
    status: "submitted" | "missing";
  };
  review: {
    reviewed_at: string | null;
    reviewed_by_role: string | null;
    reviewed_by_display: string | null;
  };
  aer_included: boolean;
  aer_reason_not_included: TraceReason | null;
};

type TraceRowInternal = TraceRow & {
  _meta: { needsReview: boolean; dueDateMs: number };
};

export type TraceResponse = {
  meta: {
    clientId: string;
    clinicId: string;
    period: { start: string; end: string };
  };
  rows: TraceRow[];
};

const REQUIRES_REVIEWED_EVIDENCE = false;

function parseDateLabel(value: string) {
  const trimmed = value.trim();
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
  }
  return { parts, label: trimmed };
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

@Injectable()
export class TraceService {
  constructor(private prisma: PrismaService) {}

  private async ensureClientAccess(params: {
    userId: string;
    role: UserRole;
    clientId: string;
  }) {
    const client = await this.prisma.clients.findUnique({
      where: { id: params.clientId },
      select: {
        id: true,
        therapist_id: true,
        therapist: { select: { id: true, clinic_id: true, user_id: true } },
      },
    });
    if (!client) throw new NotFoundException("Client not found");

    const clinicId = client.therapist?.clinic_id;
    if (!clinicId) throw new ForbiddenException("Client clinic not found");

    if (params.role === UserRole.admin) {
      return { client, clinicId, therapistId: client.therapist_id };
    }

    if (params.role === UserRole.CLINIC_ADMIN) {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: params.userId, clinic_id: clinicId },
        select: { id: true },
      });
      if (!membership) throw new ForbiddenException("Clinic membership required");
      return { client, clinicId, therapistId: client.therapist_id };
    }

    if (params.role === UserRole.therapist) {
      const therapist = await this.prisma.therapists.findFirst({
        where: { user_id: params.userId },
        select: { id: true, clinic_id: true },
      });
      if (!therapist) throw new ForbiddenException("Not a therapist");
      if (therapist.clinic_id !== clinicId) {
        throw new ForbiddenException("Client does not belong to this clinic");
      }
      if (client.therapist_id !== therapist.id) {
        throw new ForbiddenException("Client does not belong to this therapist");
      }
      return { client, clinicId, therapistId: therapist.id };
    }

    throw new ForbiddenException("Access denied");
  }

  async getClientTrace(params: {
    userId: string;
    role: UserRole;
    clientId: string;
    start: string;
    end: string;
    status?: "ALL" | "NEEDS_REVIEW" | "REVIEWED";
  }): Promise<TraceResponse> {
    const startParsed = parseDateLabel(params.start);
    const endParsed = parseDateLabel(params.end);
    const startRange = buildDateRangeFromParts(startParsed.parts);
    const endRange = buildDateRangeFromParts(endParsed.parts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("Start date must be before end date");
    }

    const { clinicId } = await this.ensureClientAccess({
      userId: params.userId,
      role: params.role,
      clientId: params.clientId,
    });

    const periodFilter = { gte: startRange.start, lte: endRange.end };

    const assignments = await this.prisma.assignments.findMany({
      where: {
        client_id: params.clientId,
        therapist: { clinic_id: clinicId },
        OR: [
          { created_at: periodFilter },
          { published_at: periodFilter },
          { due_date: periodFilter },
          { responses: { some: { created_at: periodFilter } } },
        ],
      },
      select: {
        id: true,
        title: true,
        created_at: true,
        published_at: true,
        due_date: true,
        library_item_id: true,
        library_item_version_id: true,
        library_item_version: true,
        library_source_title: true,
        library_source_slug: true,
        library_assigned_title: true,
        library_assigned_slug: true,
        library_assigned_version_number: true,
        prompt: { select: { title: true } },
      },
    });

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const responses = assignmentIds.length
      ? await this.prisma.responses.findMany({
          where: {
            client_id: params.clientId,
            assignment_id: { in: assignmentIds },
            assignment: { therapist: { clinic_id: clinicId } },
          },
          select: {
            id: true,
            assignment_id: true,
            created_at: true,
            reviewed_at: true,
            reviewed_by: { select: { user_id: true, full_name: true } },
          },
        })
      : [];

    const responsesByAssignment = new Map<string, typeof responses>();
    for (const response of responses) {
      const list = responsesByAssignment.get(response.assignment_id) ?? [];
      list.push(response);
      responsesByAssignment.set(response.assignment_id, list);
    }

    const canShowReviewerName =
      params.role === UserRole.admin || params.role === UserRole.CLINIC_ADMIN;

    const rows = assignments.map((assignment) => {
      const assignmentResponses = responsesByAssignment.get(assignment.id) ?? [];
      const responsesInPeriod = assignmentResponses.filter(
        (response) =>
          response.created_at >= startRange.start && response.created_at <= endRange.end,
      );
      const responsesOutOfPeriod = assignmentResponses.filter(
        (response) =>
          response.created_at < startRange.start || response.created_at > endRange.end,
      );

      const sortedResponses = responsesInPeriod.slice().sort((a, b) => {
        const at = a.created_at.getTime() - b.created_at.getTime();
        if (at !== 0) return at;
        return a.id.localeCompare(b.id);
      });
      const latestResponse = sortedResponses[sortedResponses.length - 1] ?? null;
      const latestReviewed = responsesInPeriod
        .filter((r) => r.reviewed_at)
        .slice()
        .sort((a, b) => {
          const at = (a.reviewed_at?.getTime() ?? 0) - (b.reviewed_at?.getTime() ?? 0);
          if (at !== 0) return at;
          return a.id.localeCompare(b.id);
        })
        .pop();

      const hasResponse = responsesInPeriod.length > 0;
      const hasReviewed = Boolean(latestReviewed?.reviewed_at);

      let aerIncluded = hasResponse;
      let reason: TraceReason | null = null;
      if (!hasResponse) {
        aerIncluded = false;
        reason = responsesOutOfPeriod.length > 0 ? "OUT_OF_PERIOD" : "NO_RESPONSE";
      } else if (REQUIRES_REVIEWED_EVIDENCE && !hasReviewed) {
        aerIncluded = false;
        reason = "UNREVIEWED";
      }

      const reviewedByDisplay = canShowReviewerName
        ? latestReviewed?.reviewed_by?.full_name ?? null
        : null;

      return {
        assignment_id: assignment.id,
        assignment_title: assignment.title ?? assignment.prompt?.title ?? null,
        library_source: assignment.library_item_id
          ? {
              item_id: assignment.library_item_id,
              version_id: assignment.library_item_version_id ?? null,
              version:
                assignment.library_assigned_version_number ??
                assignment.library_item_version ??
                null,
              title: assignment.library_assigned_title ?? assignment.library_source_title ?? null,
              slug: assignment.library_assigned_slug ?? assignment.library_source_slug ?? null,
            }
          : null,
        response: {
          response_id: latestResponse?.id ?? null,
          submitted_at: toIso(latestResponse?.created_at ?? null),
          status: hasResponse ? "submitted" : "missing",
        },
        review: {
          reviewed_at: toIso(latestReviewed?.reviewed_at ?? null),
          reviewed_by_role: latestReviewed?.reviewed_by ? "therapist" : null,
          reviewed_by_display: reviewedByDisplay,
        },
        aer_included: aerIncluded,
        aer_reason_not_included: reason,
        _meta: {
          needsReview: hasResponse && !hasReviewed,
          dueDateMs: assignment.due_date?.getTime() ?? Number.MAX_SAFE_INTEGER,
        },
      } as TraceRowInternal;
    });

    const filtered = (rows as TraceRowInternal[]).filter((row) => {
      if (params.status === "NEEDS_REVIEW") return row._meta.needsReview;
      if (params.status === "REVIEWED") return !row._meta.needsReview && row.response.status === "submitted";
      return true;
    });

    filtered.sort((a, b) => {
      if (a._meta.needsReview !== b._meta.needsReview) {
        return a._meta.needsReview ? -1 : 1;
      }
      if (a._meta.dueDateMs !== b._meta.dueDateMs) {
        return a._meta.dueDateMs - b._meta.dueDateMs;
      }
      return a.assignment_id.localeCompare(b.assignment_id);
    });

    return {
      meta: {
        clientId: params.clientId,
        clinicId,
        period: { start: formatDateOnly(startParsed.parts), end: formatDateOnly(endParsed.parts) },
      },
      rows: filtered.map(({ _meta, ...row }) => row),
    };
  }
}
