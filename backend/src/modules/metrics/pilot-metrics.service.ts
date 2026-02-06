import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AiPurpose, AiRequestStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { buildDateRangeFromParts, formatDateOnly, parseDateOnly } from "../../reports/aer/aer-report.utils";

type PilotMetricsResponse = {
  clinic_id: string;
  period: { start: string; end: string };
  review_throughput: {
    reviewed_responses_count: number;
    reviewed_checkins_count: number;
    reviewed_checkins_not_available: boolean;
    median_time_to_review_hours: number | null;
  };
  aer_usage: {
    aer_generated_count: number;
    external_access_fetch_count: number;
  };
  ai_usage: {
    drafts_generated_count: number;
    drafts_applied_count: number;
  };
  operational: {
    active_therapists: number;
    active_clients: number;
  };
};

@Injectable()
export class PilotMetricsService {
  constructor(private prisma: PrismaService) {}

  private parseRangeOrThrow(start: string, end: string) {
    const startTrimmed = start?.trim();
    const endTrimmed = end?.trim();
    if (!startTrimmed || !endTrimmed) {
      throw new BadRequestException("start and end are required (YYYY-MM-DD)");
    }

    const startParts = parseDateOnly(startTrimmed);
    if (!startParts) {
      throw new BadRequestException("Invalid start date format (expected YYYY-MM-DD)");
    }

    const endParts = parseDateOnly(endTrimmed);
    if (!endParts) {
      throw new BadRequestException("Invalid end date format (expected YYYY-MM-DD)");
    }

    const startRange = buildDateRangeFromParts(startParts);
    const endRange = buildDateRangeFromParts(endParts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("start must be before end");
    }

    return {
      start: startRange.start,
      end: endRange.end,
      startLabel: formatDateOnly(startParts),
      endLabel: formatDateOnly(endParts),
    };
  }

  private async ensureClinicAccess(userId: string, role: UserRole, clinicId: string) {
    const clinic = await this.prisma.clinics.findUnique({
      where: { id: clinicId },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");

    if (role === UserRole.admin) return;

    const membership = await this.prisma.clinic_memberships.findFirst({
      where: { user_id: userId, clinic_id: clinicId },
    });
    if (!membership) {
      throw new ForbiddenException("Clinic membership required");
    }
  }

  async getPilotMetrics(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    start: string;
    end: string;
  }): Promise<PilotMetricsResponse> {
    const range = this.parseRangeOrThrow(params.start, params.end);

    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);

    const dateFilter = { gte: range.start, lte: range.end };

    const reviewedResponsesPromise = this.prisma.responses.findMany({
      where: {
        reviewed_at: dateFilter,
        assignment: { therapist: { clinic_id: params.clinicId } },
      },
      select: { created_at: true, reviewed_at: true },
    });

    const reviewedResponsesCountPromise = this.prisma.responses.count({
      where: {
        reviewed_at: dateFilter,
        assignment: { therapist: { clinic_id: params.clinicId } },
      },
    });

    const aerGeneratedCountPromise = this.prisma.audit_logs.count({
      where: {
        action: "aer.generate",
        entity_type: "clinic",
        entity_id: params.clinicId,
        created_at: dateFilter,
      },
    });

    const externalAccessFetchCountPromise = this.prisma.external_access_token_uses.count({
      where: {
        used_at: dateFilter,
        token: { clinic_id: params.clinicId },
      },
    });

    const draftsGeneratedCountPromise = this.prisma.ai_request_logs.count({
      where: {
        clinic_id: params.clinicId,
        status: AiRequestStatus.ALLOWED,
        purpose: { in: [AiPurpose.DOCUMENTATION, AiPurpose.SUPERVISOR_SUMMARY] },
        created_at: dateFilter,
      },
    });

    const draftsAppliedCountPromise = this.prisma.audit_logs.count({
      where: {
        action: "ai.draft.apply",
        entity_type: "clinic",
        entity_id: params.clinicId,
        created_at: dateFilter,
      },
    });

    const activeTherapistsPromise = this.prisma.therapists.count({
      where: {
        clinic_id: params.clinicId,
        OR: [
          { assignments: { some: { created_at: dateFilter } } },
          { assignments: { some: { responses: { some: { created_at: dateFilter } } } } },
          { reviewed_responses: { some: { reviewed_at: dateFilter } } },
        ],
      },
    });

    const activeClientsPromise = this.prisma.clients.count({
      where: {
        therapist: { clinic_id: params.clinicId },
        OR: [
          { assignments: { some: { created_at: dateFilter } } },
          { responses: { some: { created_at: dateFilter } } },
        ],
      },
    });

    const [
      reviewedRows,
      reviewedResponsesCount,
      aerGeneratedCount,
      externalAccessFetchCount,
      draftsGeneratedCount,
      draftsAppliedCount,
      activeTherapists,
      activeClients,
    ] = await Promise.all([
      reviewedResponsesPromise,
      reviewedResponsesCountPromise,
      aerGeneratedCountPromise,
      externalAccessFetchCountPromise,
      draftsGeneratedCountPromise,
      draftsAppliedCountPromise,
      activeTherapistsPromise,
      activeClientsPromise,
    ]);

    const durations = reviewedRows
      .filter((row) => row.reviewed_at)
      .map((row) => {
        const created = row.created_at?.getTime?.() ?? 0;
        const reviewed = row.reviewed_at?.getTime?.() ?? 0;
        return Math.max(0, (reviewed - created) / 3600000);
      })
      .filter((value) => Number.isFinite(value));

    durations.sort((a, b) => a - b);

    let median: number | null = null;
    if (durations.length > 0) {
      const mid = Math.floor(durations.length / 2);
      if (durations.length % 2 === 0) {
        median = (durations[mid - 1] + durations[mid]) / 2;
      } else {
        median = durations[mid];
      }
      median = Number(median.toFixed(2));
    }

    return {
      clinic_id: params.clinicId,
      period: { start: range.startLabel, end: range.endLabel },
      review_throughput: {
        reviewed_responses_count: reviewedResponsesCount,
        reviewed_checkins_count: 0,
        reviewed_checkins_not_available: true,
        median_time_to_review_hours: median,
      },
      aer_usage: {
        aer_generated_count: aerGeneratedCount,
        external_access_fetch_count: externalAccessFetchCount,
      },
      ai_usage: {
        drafts_generated_count: draftsGeneratedCount,
        drafts_applied_count: draftsAppliedCount,
      },
      operational: {
        active_therapists: activeTherapists,
        active_clients: activeClients,
      },
    };
  }
}
