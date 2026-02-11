import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ResponseCompletionStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildBucketRanges,
  computeMedian,
  MetricsBucket,
  MetricsDateRange,
  parseDateRangeOrThrow,
} from "./review-metrics.utils";

type MetricsNotAvailable = {
  reviewed_responses_count: boolean;
  median_time_to_review_hours: boolean;
  review_backlog_count: boolean;
  assignment_completion_rate: boolean;
  overdue_rate: boolean;
  escalation_open_count: boolean;
  escalation_median_time_to_resolve_hours: boolean;
  aer_generated_count: boolean;
};

export type ReviewRevenueMetricsSummary = {
  reviewed_responses_count: number;
  median_time_to_review_hours: number | null;
  review_backlog_count: number;
  assignment_completion_rate: number | null;
  overdue_rate: number | null;
  escalation_open_count: number;
  escalation_median_time_to_resolve_hours: number | null;
  aer_generated_count: number;
  not_available: MetricsNotAvailable;
};

export type ReviewRevenueMetricsResponse = {
  ok: boolean;
  meta: {
    clinicId: string;
    start: string;
    end: string;
    scope: "clinic" | "therapist";
    therapistId?: string | null;
    generatedAt: string;
  };
  summary: ReviewRevenueMetricsSummary;
  error?: { code: string; message: string };
};

export type ReviewRevenueMetricsSeriesPoint = {
  bucket_start: string;
  reviewed_responses_count: number;
  review_backlog_count: number;
  assignment_completion_rate: number | null;
  overdue_rate: number | null;
  escalation_open_count: number;
};

export type ReviewRevenueMetricsSeriesResponse = {
  ok: boolean;
  meta: {
    clinicId: string;
    start: string;
    end: string;
    bucket: MetricsBucket;
    scope: "clinic";
    generatedAt: string;
  };
  series: {
    points: ReviewRevenueMetricsSeriesPoint[];
    not_available: Pick<
      MetricsNotAvailable,
      | "reviewed_responses_count"
      | "review_backlog_count"
      | "assignment_completion_rate"
      | "overdue_rate"
      | "escalation_open_count"
    >;
  };
  error?: { code: string; message: string };
};

const DEFAULT_NOT_AVAILABLE: MetricsNotAvailable = {
  reviewed_responses_count: false,
  median_time_to_review_hours: false,
  review_backlog_count: false,
  assignment_completion_rate: false,
  overdue_rate: false,
  escalation_open_count: false,
  escalation_median_time_to_resolve_hours: false,
  aer_generated_count: false,
};

const clampHours = (value: number) => Number(value.toFixed(2));

@Injectable()
export class ReviewRevenueMetricsService {
  constructor(private prisma: PrismaService) {}

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

  private async resolveTherapistScope(userId: string, clinicId: string) {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: userId },
      select: { id: true, clinic_id: true },
    });
    if (!therapist) throw new ForbiddenException("Therapist access required");
    if (therapist.clinic_id !== clinicId) {
      throw new ForbiddenException("Therapist does not belong to clinic");
    }
    return therapist;
  }

  private async getTherapistClientIds(therapistId: string) {
    const rows = await this.prisma.clients.findMany({
      where: { therapist_id: therapistId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async safeQuery<T>(
    fn: () => Promise<T>,
    onError: () => T,
  ): Promise<{ value: T; ok: boolean }> {
    try {
      return { value: await fn(), ok: true };
    } catch {
      return { value: onError(), ok: false };
    }
  }

  private buildSummary(params: {
    clinicId: string;
    scope: "clinic" | "therapist";
    range: MetricsDateRange;
    therapistId?: string | null;
    reviewedRows: { created_at: Date; reviewed_at: Date | null }[];
    reviewBacklogCount: number;
    assignmentTotal: number;
    assignmentCompleted: number;
    escalationOpenCount: number;
    escalationResolvedRows: { created_at: Date; resolved_at: Date | null }[];
    aerGeneratedCount: number;
    notAvailable: MetricsNotAvailable;
  }): ReviewRevenueMetricsResponse {
    const reviewDurations = params.reviewedRows
      .filter((row) => row.reviewed_at)
      .map((row) =>
        Math.max(0, (row.reviewed_at!.getTime() - row.created_at.getTime()) / 3600000),
      )
      .filter((value) => Number.isFinite(value));

    const medianReview =
      params.notAvailable.reviewed_responses_count || params.notAvailable.median_time_to_review_hours
        ? null
        : computeMedian(reviewDurations);

    const total = params.assignmentTotal;
    const completed = params.assignmentCompleted;

    let completionRate: number | null = null;
    let overdueRate: number | null = null;

    if (!params.notAvailable.assignment_completion_rate && total > 0) {
      completionRate = completed / total;
    }

    if (!params.notAvailable.overdue_rate && total > 0) {
      overdueRate = Math.max(0, total - completed) / total;
    }

    const escalationDurations = params.escalationResolvedRows
      .filter((row) => row.resolved_at)
      .map((row) =>
        Math.max(0, (row.resolved_at!.getTime() - row.created_at.getTime()) / 3600000),
      )
      .filter((value) => Number.isFinite(value));

    const escalationMedian =
      params.notAvailable.escalation_median_time_to_resolve_hours
        ? null
        : computeMedian(escalationDurations);

    const summary: ReviewRevenueMetricsSummary = {
      reviewed_responses_count: params.notAvailable.reviewed_responses_count
        ? 0
        : params.reviewedRows.length,
      median_time_to_review_hours:
        medianReview === null ? null : clampHours(medianReview),
      review_backlog_count: params.notAvailable.review_backlog_count ? 0 : params.reviewBacklogCount,
      assignment_completion_rate:
        completionRate === null ? null : Number(completionRate.toFixed(4)),
      overdue_rate: overdueRate === null ? null : Number(overdueRate.toFixed(4)),
      escalation_open_count: params.notAvailable.escalation_open_count
        ? 0
        : params.escalationOpenCount,
      escalation_median_time_to_resolve_hours:
        escalationMedian === null ? null : clampHours(escalationMedian),
      aer_generated_count: params.notAvailable.aer_generated_count ? 0 : params.aerGeneratedCount,
      not_available: params.notAvailable,
    };

    return {
      ok: true,
      meta: {
        clinicId: params.clinicId,
        start: params.range.startLabel,
        end: params.range.endLabel,
        scope: params.scope,
        therapistId: params.therapistId ?? null,
        generatedAt: new Date().toISOString(),
      },
      summary,
    };
  }

  private baseFailureResponse(params: {
    clinicId: string;
    scope: "clinic" | "therapist";
    range: MetricsDateRange;
    therapistId?: string | null;
    message: string;
  }): ReviewRevenueMetricsResponse {
    const notAvailable = { ...DEFAULT_NOT_AVAILABLE };
    Object.keys(notAvailable).forEach((key) => {
      (notAvailable as Record<string, boolean>)[key] = true;
    });

    return {
      ok: false,
      meta: {
        clinicId: params.clinicId,
        start: params.range.startLabel,
        end: params.range.endLabel,
        scope: params.scope,
        therapistId: params.therapistId ?? null,
        generatedAt: new Date().toISOString(),
      },
      summary: {
        reviewed_responses_count: 0,
        median_time_to_review_hours: null,
        review_backlog_count: 0,
        assignment_completion_rate: null,
        overdue_rate: null,
        escalation_open_count: 0,
        escalation_median_time_to_resolve_hours: null,
        aer_generated_count: 0,
        not_available: notAvailable,
      },
      error: { code: "metrics_unavailable", message: params.message },
    };
  }

  async getClinicMetrics(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    start: string;
    end: string;
  }): Promise<ReviewRevenueMetricsResponse> {
    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);
    const range = parseDateRangeOrThrow(params.start, params.end);

    const notAvailable: MetricsNotAvailable = { ...DEFAULT_NOT_AVAILABLE };

    try {
      const reviewedRowsPromise = this.safeQuery(
        () =>
          this.prisma.responses.findMany({
            where: {
              reviewed_at: { gte: range.start, lte: range.end },
              assignment: { therapist: { clinic_id: params.clinicId } },
            },
            select: { created_at: true, reviewed_at: true },
          }),
        () => [],
      );

      const reviewBacklogPromise = this.safeQuery(
        () =>
          this.prisma.responses.count({
            where: {
              created_at: { gte: range.start, lte: range.end },
              reviewed_at: null,
              assignment: { therapist: { clinic_id: params.clinicId } },
            },
          }),
        () => 0,
      );

      const assignmentTotalPromise = this.safeQuery(
        () =>
          this.prisma.assignments.count({
            where: {
              status: "published",
              due_date: { gte: range.start, lte: range.end },
              therapist: { clinic_id: params.clinicId },
            },
          }),
        () => 0,
      );

      const assignmentCompletedPromise = this.safeQuery(
        () =>
          this.prisma.assignments.count({
            where: {
              status: "published",
              due_date: { gte: range.start, lte: range.end },
              therapist: { clinic_id: params.clinicId },
              responses: {
                some: {
                  completion_status: { not: ResponseCompletionStatus.PARTIAL },
                  created_at: { lte: range.end },
                },
              },
            },
          }),
        () => 0,
      );

      const escalationOpenPromise = this.safeQuery(
        () =>
          this.prisma.supervisor_escalations.count({
            where: {
              clinic_id: params.clinicId,
              status: "OPEN",
              created_at: { lte: range.end },
            },
          }),
        () => 0,
      );

      const escalationResolvedPromise = this.safeQuery(
        () =>
          this.prisma.supervisor_escalations.findMany({
            where: {
              clinic_id: params.clinicId,
              resolved_at: { gte: range.start, lte: range.end },
            },
            select: { created_at: true, resolved_at: true },
          }),
        () => [],
      );

      const aerGeneratedPromise = this.safeQuery(
        () =>
          this.prisma.audit_logs.count({
            where: {
              action: "aer.generate",
              entity_type: "clinic",
              entity_id: params.clinicId,
              created_at: { gte: range.start, lte: range.end },
            },
          }),
        () => 0,
      );

      const [
        reviewedRowsResult,
        reviewBacklogResult,
        assignmentTotalResult,
        assignmentCompletedResult,
        escalationOpenResult,
        escalationResolvedResult,
        aerGeneratedResult,
      ] = await Promise.all([
        reviewedRowsPromise,
        reviewBacklogPromise,
        assignmentTotalPromise,
        assignmentCompletedPromise,
        escalationOpenPromise,
        escalationResolvedPromise,
        aerGeneratedPromise,
      ]);

      if (!reviewedRowsResult.ok) {
        notAvailable.reviewed_responses_count = true;
        notAvailable.median_time_to_review_hours = true;
      }
      if (!reviewBacklogResult.ok) {
        notAvailable.review_backlog_count = true;
      }
      if (!assignmentTotalResult.ok || !assignmentCompletedResult.ok) {
        notAvailable.assignment_completion_rate = true;
        notAvailable.overdue_rate = true;
      }
      if (!escalationOpenResult.ok) {
        notAvailable.escalation_open_count = true;
      }
      if (!escalationResolvedResult.ok) {
        notAvailable.escalation_median_time_to_resolve_hours = true;
      }
      if (!aerGeneratedResult.ok) {
        notAvailable.aer_generated_count = true;
      }

      return this.buildSummary({
        clinicId: params.clinicId,
        scope: "clinic",
        range,
        reviewedRows: reviewedRowsResult.value,
        reviewBacklogCount: reviewBacklogResult.value,
        assignmentTotal: assignmentTotalResult.value,
        assignmentCompleted: assignmentCompletedResult.value,
        escalationOpenCount: escalationOpenResult.value,
        escalationResolvedRows: escalationResolvedResult.value,
        aerGeneratedCount: aerGeneratedResult.value,
        notAvailable,
      });
    } catch {
      return this.baseFailureResponse({
        clinicId: params.clinicId,
        scope: "clinic",
        range,
        message: "Metrics temporarily unavailable",
      });
    }
  }

  async getTherapistMetrics(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    start: string;
    end: string;
  }): Promise<ReviewRevenueMetricsResponse> {
    if (params.role !== UserRole.therapist) {
      throw new ForbiddenException("Therapist access required");
    }

    const range = parseDateRangeOrThrow(params.start, params.end);
    const therapist = await this.resolveTherapistScope(params.userId, params.clinicId);
    const notAvailable: MetricsNotAvailable = { ...DEFAULT_NOT_AVAILABLE };

    try {
      const reviewedRowsPromise = this.safeQuery(
        () =>
          this.prisma.responses.findMany({
            where: {
              reviewed_at: { gte: range.start, lte: range.end },
              assignment: { therapist_id: therapist.id },
            },
            select: { created_at: true, reviewed_at: true },
          }),
        () => [],
      );

      const reviewBacklogPromise = this.safeQuery(
        () =>
          this.prisma.responses.count({
            where: {
              created_at: { gte: range.start, lte: range.end },
              reviewed_at: null,
              assignment: { therapist_id: therapist.id },
            },
          }),
        () => 0,
      );

      const assignmentTotalPromise = this.safeQuery(
        () =>
          this.prisma.assignments.count({
            where: {
              status: "published",
              due_date: { gte: range.start, lte: range.end },
              therapist_id: therapist.id,
            },
          }),
        () => 0,
      );

      const assignmentCompletedPromise = this.safeQuery(
        () =>
          this.prisma.assignments.count({
            where: {
              status: "published",
              due_date: { gte: range.start, lte: range.end },
              therapist_id: therapist.id,
              responses: {
                some: {
                  completion_status: { not: ResponseCompletionStatus.PARTIAL },
                  created_at: { lte: range.end },
                },
              },
            },
          }),
        () => 0,
      );

      const clientIdsPromise = this.safeQuery(
        () => this.getTherapistClientIds(therapist.id),
        () => [],
      );

      const escalationOpenPromise = this.safeQuery(
        async () => {
          const clientIds = (await clientIdsPromise).value;
          if (clientIds.length === 0) return 0;
          return this.prisma.supervisor_escalations.count({
            where: {
              clinic_id: params.clinicId,
              status: "OPEN",
              created_at: { lte: range.end },
              client_id: { in: clientIds },
            },
          });
        },
        () => 0,
      );

      const escalationResolvedPromise = this.safeQuery(
        async () => {
          const clientIds = (await clientIdsPromise).value;
          if (clientIds.length === 0) return [];
          return this.prisma.supervisor_escalations.findMany({
            where: {
              clinic_id: params.clinicId,
              resolved_at: { gte: range.start, lte: range.end },
              client_id: { in: clientIds },
            },
            select: { created_at: true, resolved_at: true },
          });
        },
        () => [],
      );

      const aerGeneratedPromise = this.safeQuery(
        () =>
          this.prisma.audit_logs.count({
            where: {
              action: "aer.generate",
              user_id: params.userId,
              created_at: { gte: range.start, lte: range.end },
            },
          }),
        () => 0,
      );

      const [
        reviewedRowsResult,
        reviewBacklogResult,
        assignmentTotalResult,
        assignmentCompletedResult,
        clientIdsResult,
        escalationOpenResult,
        escalationResolvedResult,
        aerGeneratedResult,
      ] = await Promise.all([
        reviewedRowsPromise,
        reviewBacklogPromise,
        assignmentTotalPromise,
        assignmentCompletedPromise,
        clientIdsPromise,
        escalationOpenPromise,
        escalationResolvedPromise,
        aerGeneratedPromise,
      ]);

      if (!reviewedRowsResult.ok) {
        notAvailable.reviewed_responses_count = true;
        notAvailable.median_time_to_review_hours = true;
      }
      if (!reviewBacklogResult.ok) {
        notAvailable.review_backlog_count = true;
      }
      if (!assignmentTotalResult.ok || !assignmentCompletedResult.ok) {
        notAvailable.assignment_completion_rate = true;
        notAvailable.overdue_rate = true;
      }
      if (!clientIdsResult.ok || !escalationOpenResult.ok) {
        notAvailable.escalation_open_count = true;
      }
      if (!clientIdsResult.ok || !escalationResolvedResult.ok) {
        notAvailable.escalation_median_time_to_resolve_hours = true;
      }
      if (!aerGeneratedResult.ok) {
        notAvailable.aer_generated_count = true;
      }

      return this.buildSummary({
        clinicId: params.clinicId,
        scope: "therapist",
        range,
        therapistId: therapist.id,
        reviewedRows: reviewedRowsResult.value,
        reviewBacklogCount: reviewBacklogResult.value,
        assignmentTotal: assignmentTotalResult.value,
        assignmentCompleted: assignmentCompletedResult.value,
        escalationOpenCount: escalationOpenResult.value,
        escalationResolvedRows: escalationResolvedResult.value,
        aerGeneratedCount: aerGeneratedResult.value,
        notAvailable,
      });
    } catch {
      return this.baseFailureResponse({
        clinicId: params.clinicId,
        scope: "therapist",
        range,
        therapistId: therapist.id,
        message: "Metrics temporarily unavailable",
      });
    }
  }

  async getClinicSeries(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    start: string;
    end: string;
    bucket: MetricsBucket;
  }): Promise<ReviewRevenueMetricsSeriesResponse> {
    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);
    const range = parseDateRangeOrThrow(params.start, params.end);
    const buckets = buildBucketRanges(range, params.bucket);

    const notAvailable = {
      reviewed_responses_count: false,
      review_backlog_count: false,
      assignment_completion_rate: false,
      overdue_rate: false,
      escalation_open_count: false,
    };

    try {
      const points: ReviewRevenueMetricsSeriesPoint[] = [];

      for (const bucket of buckets) {
        const [
          reviewedRowsResult,
          reviewBacklogResult,
          assignmentTotalResult,
          assignmentCompletedResult,
          escalationOpenResult,
        ] = await Promise.all([
          this.safeQuery(
            () =>
              this.prisma.responses.findMany({
                where: {
                  reviewed_at: { gte: bucket.start, lte: bucket.end },
                  assignment: { therapist: { clinic_id: params.clinicId } },
                },
                select: { id: true },
              }),
            () => [],
          ),
          this.safeQuery(
            () =>
              this.prisma.responses.count({
                where: {
                  created_at: { gte: bucket.start, lte: bucket.end },
                  reviewed_at: null,
                  assignment: { therapist: { clinic_id: params.clinicId } },
                },
              }),
            () => 0,
          ),
          this.safeQuery(
            () =>
              this.prisma.assignments.count({
                where: {
                  status: "published",
                  due_date: { gte: bucket.start, lte: bucket.end },
                  therapist: { clinic_id: params.clinicId },
                },
              }),
            () => 0,
          ),
          this.safeQuery(
            () =>
              this.prisma.assignments.count({
                where: {
                  status: "published",
                  due_date: { gte: bucket.start, lte: bucket.end },
                  therapist: { clinic_id: params.clinicId },
                  responses: {
                    some: {
                      completion_status: { not: ResponseCompletionStatus.PARTIAL },
                      created_at: { lte: bucket.end },
                    },
                  },
                },
              }),
            () => 0,
          ),
          this.safeQuery(
            () =>
              this.prisma.supervisor_escalations.count({
                where: {
                  clinic_id: params.clinicId,
                  status: "OPEN",
                  created_at: { lte: bucket.end },
                },
              }),
            () => 0,
          ),
        ]);

        if (!reviewedRowsResult.ok) notAvailable.reviewed_responses_count = true;
        if (!reviewBacklogResult.ok) notAvailable.review_backlog_count = true;
        if (!assignmentTotalResult.ok || !assignmentCompletedResult.ok) {
          notAvailable.assignment_completion_rate = true;
          notAvailable.overdue_rate = true;
        }
        if (!escalationOpenResult.ok) notAvailable.escalation_open_count = true;

        const totalAssignments = assignmentTotalResult.value;
        const completedAssignments = assignmentCompletedResult.value;
        const completionRate =
          totalAssignments > 0
            ? Number((completedAssignments / totalAssignments).toFixed(4))
            : null;
        const overdueRate =
          totalAssignments > 0
            ? Number(((totalAssignments - completedAssignments) / totalAssignments).toFixed(4))
            : null;

        points.push({
          bucket_start: bucket.label,
          reviewed_responses_count: reviewedRowsResult.value.length,
          review_backlog_count: reviewBacklogResult.value,
          assignment_completion_rate: completionRate,
          overdue_rate: overdueRate,
          escalation_open_count: escalationOpenResult.value,
        });
      }

      return {
        ok: true,
        meta: {
          clinicId: params.clinicId,
          start: range.startLabel,
          end: range.endLabel,
          bucket: params.bucket,
          scope: "clinic",
          generatedAt: new Date().toISOString(),
        },
        series: {
          points,
          not_available: notAvailable,
        },
      };
    } catch {
      return {
        ok: false,
        meta: {
          clinicId: params.clinicId,
          start: range.startLabel,
          end: range.endLabel,
          bucket: params.bucket,
          scope: "clinic",
          generatedAt: new Date().toISOString(),
        },
        series: {
          points: [],
          not_available: {
            reviewed_responses_count: true,
            review_backlog_count: true,
            assignment_completion_rate: true,
            overdue_rate: true,
            escalation_open_count: true,
          },
        },
        error: { code: "metrics_unavailable", message: "Metrics temporarily unavailable" },
      };
    }
  }
}
