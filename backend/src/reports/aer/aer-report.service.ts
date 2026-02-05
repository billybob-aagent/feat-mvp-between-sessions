import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { UserRole } from "@prisma/client";
import { toDateOnlyStringLocal } from "./aer-report.utils";

type AerReport = {
  meta: {
    report_type: "AER";
    version: "v1";
    generated_at: string;
    period: { start: string; end: string };
    clinic_id: string;
    client_id: string;
    program: string | null;
    generated_by: { type: "system"; id: "backend" };
  };
  context: {
    clinic: { name: string | null };
    client: { display_id: string | null };
  };
  prescribed_interventions: Array<{
    assignment_id: string;
    title: string | null;
    library_source: {
      item_id: string;
      version_id: string | null;
      version: number | null;
      title: string | null;
      slug: string | null;
      content_type: string | null;
      status: "PUBLISHED";
    } | null;
    assigned_by: { user_id: string | null; name: string | null };
    assigned_at: string | null;
    due: { start: string | null; end: string | null };
    completion_criteria: string | null;
    completed_at: string | null;
    reviewed_at: string | null;
    reviewed_by: { user_id: string | null; name: string | null };
    evidence_refs: string[];
    status_summary: { completed: number; partial: number; missed: number; late: number };
  }>;
  adherence_timeline: Array<{
    ts: string;
    type:
      | "assignment_completed"
      | "assignment_partial"
      | "assignment_missed"
      | "checkin"
      | "feedback"
      | "notification_sent"
      | "other";
    source: "client" | "system" | "clinician";
    ref: { assignment_id: string | null; response_id: string | null };
    details: Record<string, any>;
  }>;
  noncompliance_escalations: Array<{
    ts: string;
    type: "reminder" | "escalation";
    channel: "email" | "sms" | "inapp" | "unknown";
    details: Record<string, any>;
  }>;
  clinician_review: {
    reviewed: boolean;
    reviewed_at: string | null;
    reviewed_by: { user_id: string | null; name: string | null };
    notes: string | null;
  };
  audit_integrity: {
    data_sources: string[];
    notes: string;
    report_id: string;
    hash: string | null;
  };
  not_available: string[];
};

type AssignmentRow = {
  id: string;
  title: string | null;
  created_at: Date;
  published_at: Date | null;
  due_date: Date | null;
  library_item_id: string | null;
  library_item_version_id: string | null;
  library_item_version: number | null;
  library_source_title: string | null;
  library_source_slug: string | null;
  library_source_content_type: string | null;
  library_assigned_title: string | null;
  library_assigned_slug: string | null;
  library_assigned_version_number: number | null;
  therapist: { user_id: string; full_name: string } | null;
  prompt: { title: string } | null;
};

type ResponseRow = {
  id: string;
  assignment_id: string;
  created_at: Date;
  mood: number;
  reviewed_at: Date | null;
  reviewed_by: { user_id: string; full_name: string } | null;
  flagged_at: Date | null;
  starred_at: Date | null;
};

type FeedbackRow = {
  response_id: string;
  created_at: Date;
  therapist: { user_id: string; full_name: string } | null;
  response: { assignment_id: string };
};

type CheckinRow = { id: string; created_at: Date; mood: number };

type NotificationRow = { type: string; dedupe_key: string | null; created_at: Date };

const toIso = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const parseAssignmentId = (dedupeKey: string | null) => {
  if (!dedupeKey) return null;
  const match = dedupeKey.match(/assignment:([^:]+):/);
  return match ? match[1] : null;
};

@Injectable()
export class AerReportService {
  constructor(private prisma: PrismaService) {}

  async ensureClinicAccess(userId: string, role: UserRole, clinicId: string) {
    if (role === UserRole.admin) return;
    const membership = await this.prisma.clinic_memberships.findFirst({
      where: { user_id: userId, clinic_id: clinicId },
    });
    if (!membership) {
      throw new ForbiddenException("Clinic membership required");
    }
  }

  async generateAerReport(
    clinicId: string,
    clientId: string,
    start: Date,
    end: Date,
    program?: string,
    options?: {
      periodStartLabel?: string;
      periodEndLabel?: string;
      generatedAtOverride?: Date;
    },
  ): Promise<AerReport> {
    const notAvailable: string[] = [];
    const addNotAvailable = (entry: string) => {
      if (!notAvailable.includes(entry)) notAvailable.push(entry);
    };

    if (program) {
      addNotAvailable("program filter (no program field to filter assignments/clients)");
    }

    const [clinic, client] = await Promise.all([
      this.prisma.clinics.findUnique({
        where: { id: clinicId },
        select: { name: true },
      }),
      this.prisma.clients.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          user_id: true,
          therapist: { select: { clinic_id: true } },
        },
      }),
    ]);

    if (!clinic) throw new NotFoundException("Clinic not found");
    if (!client) throw new NotFoundException("Client not found");
    if (client.therapist?.clinic_id !== clinicId) {
      throw new ForbiddenException("Client does not belong to clinic");
    }

    const periodFilter = { gte: start, lte: end };

    const assignments = (await this.prisma.assignments.findMany({
      where: {
        client_id: clientId,
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
        library_source_content_type: true,
        library_assigned_title: true,
        library_assigned_slug: true,
        library_assigned_version_number: true,
        therapist: { select: { user_id: true, full_name: true } },
        prompt: { select: { title: true } },
      },
    })) as AssignmentRow[];

    const responses = (await this.prisma.responses.findMany({
      where: {
        client_id: clientId,
        created_at: periodFilter,
        assignment: { therapist: { clinic_id: clinicId } },
      },
      select: {
        id: true,
        assignment_id: true,
        created_at: true,
        mood: true,
        reviewed_at: true,
        reviewed_by: { select: { user_id: true, full_name: true } },
        flagged_at: true,
        starred_at: true,
      },
    })) as ResponseRow[];

    const feedback = (await this.prisma.feedback.findMany({
      where: {
        created_at: periodFilter,
        response: {
          client_id: clientId,
          assignment: { therapist: { clinic_id: clinicId } },
        },
      },
      select: {
        response_id: true,
        created_at: true,
        therapist: { select: { user_id: true, full_name: true } },
        response: { select: { assignment_id: true } },
      },
    })) as FeedbackRow[];

    const checkins = (await this.prisma.checkins.findMany({
      where: { client_id: clientId, created_at: periodFilter },
      select: { id: true, created_at: true, mood: true },
    })) as CheckinRow[];

    const notifications = (await this.prisma.notifications.findMany({
      where: { user_id: client.user_id, created_at: periodFilter },
      select: { type: true, dedupe_key: true, created_at: true },
    })) as NotificationRow[];

    const latestReview = await this.prisma.responses.findFirst({
      where: {
        client_id: clientId,
        reviewed_at: periodFilter,
        assignment: { therapist: { clinic_id: clinicId } },
      },
      orderBy: { reviewed_at: "desc" },
      select: {
        reviewed_at: true,
        reviewed_by: { select: { user_id: true, full_name: true } },
      },
    });

    addNotAvailable("context.client.display_id (no display_id in clients table)");
    addNotAvailable("prescribed_interventions.completion_criteria (no field in assignments/prompts)");
    addNotAvailable("prescribed_interventions.status_summary.partial (no partial completion model)");
    addNotAvailable("clinician_review.notes (no review notes model)");
    addNotAvailable("noncompliance_escalations.channel (delivery channel not stored)");
    addNotAvailable("audit_integrity.hash (not implemented in v1)");

    const responsesByAssignment = new Map<string, ResponseRow[]>();
    for (const response of responses) {
      const list = responsesByAssignment.get(response.assignment_id) ?? [];
      list.push(response);
      responsesByAssignment.set(response.assignment_id, list);
    }

    const assignedById = new Map<string, AssignmentRow>();
    for (const assignment of assignments) {
      assignedById.set(assignment.id, assignment);
    }

    const prescribed_interventions = assignments.map((assignment) => {
      const assignedAt = assignment.published_at ?? assignment.created_at ?? null;
      const assignmentResponses = responsesByAssignment.get(assignment.id) ?? [];
      const sortedResponses = assignmentResponses
        .slice()
        .sort((a, b) => {
          const at = a.created_at.getTime() - b.created_at.getTime();
          if (at !== 0) return at;
          return a.id.localeCompare(b.id);
        });
      const firstResponse = sortedResponses[0];
      const latestReview = assignmentResponses
        .filter((r) => r.reviewed_at)
        .slice()
        .sort((a, b) => {
          const at = (a.reviewed_at?.getTime() ?? 0) - (b.reviewed_at?.getTime() ?? 0);
          if (at !== 0) return at;
          return a.id.localeCompare(b.id);
        })
        .pop();
      const completed = assignmentResponses.length > 0 ? 1 : 0;
      const late =
        completed && assignment.due_date && firstResponse
          ? firstResponse.created_at > assignment.due_date
            ? 1
            : 0
          : 0;
      const missed =
        assignmentResponses.length === 0 &&
        assignment.due_date &&
        assignment.due_date <= end
          ? 1
          : 0;

      return {
        assignment_id: assignment.id,
        title: assignment.title ?? assignment.prompt?.title ?? null,
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
              content_type: assignment.library_source_content_type ?? null,
              status: "PUBLISHED" as const,
            }
          : null,
        assigned_by: {
          user_id: assignment.therapist?.user_id ?? null,
          name: assignment.therapist?.full_name ?? null,
        },
        assigned_at: toIso(assignedAt),
        due: {
          start: toIso(assignedAt),
          end: toIso(assignment.due_date),
        },
        completion_criteria: null,
        completed_at: toIso(firstResponse?.created_at ?? null),
        reviewed_at: toIso(latestReview?.reviewed_at ?? null),
        reviewed_by: {
          user_id: latestReview?.reviewed_by?.user_id ?? null,
          name: latestReview?.reviewed_by?.full_name ?? null,
        },
        evidence_refs: sortedResponses.map((r) => r.id),
        status_summary: {
          completed,
          partial: 0,
          missed,
          late,
        },
      };
    });

    const adherence_timeline: AerReport["adherence_timeline"] = [];

    for (const response of responses) {
      const assignment = assignedById.get(response.assignment_id);
      const late =
        assignment?.due_date && response.created_at
          ? response.created_at > assignment.due_date
          : false;
      adherence_timeline.push({
        ts: response.created_at.toISOString(),
        type: "assignment_completed",
        source: "client",
        ref: { assignment_id: response.assignment_id, response_id: response.id },
        details: {
          mood: response.mood,
          reviewed_at: toIso(response.reviewed_at),
          flagged_at: toIso(response.flagged_at),
          starred_at: toIso(response.starred_at),
          late,
        },
      });
    }

    for (const checkin of checkins) {
      adherence_timeline.push({
        ts: checkin.created_at.toISOString(),
        type: "checkin",
        source: "client",
        ref: { assignment_id: null, response_id: null },
        details: { checkin_id: checkin.id, mood: checkin.mood },
      });
    }

    for (const entry of feedback) {
      adherence_timeline.push({
        ts: entry.created_at.toISOString(),
        type: "feedback",
        source: "clinician",
        ref: { assignment_id: entry.response.assignment_id, response_id: entry.response_id },
        details: {
          therapist_user_id: entry.therapist?.user_id ?? null,
          therapist_name: entry.therapist?.full_name ?? null,
        },
      });
    }

    for (const notification of notifications) {
      adherence_timeline.push({
        ts: notification.created_at.toISOString(),
        type: "notification_sent",
        source: "system",
        ref: {
          assignment_id: parseAssignmentId(notification.dedupe_key),
          response_id: null,
        },
        details: { notification_type: notification.type },
      });
    }

    for (const assignment of prescribed_interventions) {
      const status = assignment.status_summary;
      const dueDate = assignedById.get(assignment.assignment_id)?.due_date ?? null;
      if (status.missed === 1 && dueDate) {
        adherence_timeline.push({
          ts: dueDate.toISOString(),
          type: "assignment_missed",
          source: "system",
          ref: { assignment_id: assignment.assignment_id, response_id: null },
          details: { reason: "no_response_by_due_date" },
        });
      }
    }

    adherence_timeline.sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
    );

    const noncompliance_escalations = notifications
      .filter(
        (notification) =>
          notification.type === "assignment_due_24h" ||
          notification.type === "assignment_manual_reminder",
      )
      .map((notification) => ({
        ts: notification.created_at.toISOString(),
        type: "reminder" as const,
        channel: "unknown" as const,
        details: {
          notification_type: notification.type,
          assignment_id: parseAssignmentId(notification.dedupe_key),
        },
      }))
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const periodStart = options?.periodStartLabel ?? toDateOnlyStringLocal(start);
    const periodEnd = options?.periodEndLabel ?? toDateOnlyStringLocal(end);
    const reportId = `AER-v1:${clinicId}:${clientId}:${periodStart}:${periodEnd}${
      program ? `:${program}` : ""
    }`;

    const generatedAt = options?.generatedAtOverride ?? new Date();

    return {
      meta: {
        report_type: "AER",
        version: "v1",
        generated_at: generatedAt.toISOString(),
        period: { start: periodStart, end: periodEnd },
        clinic_id: clinicId,
        client_id: clientId,
        program: program ?? null,
        generated_by: { type: "system", id: "backend" },
      },
      context: {
        clinic: { name: clinic?.name ?? null },
        client: { display_id: null },
      },
      prescribed_interventions,
      adherence_timeline,
      noncompliance_escalations,
      clinician_review: {
        reviewed: Boolean(latestReview?.reviewed_at),
        reviewed_at: toIso(latestReview?.reviewed_at ?? null),
        reviewed_by: {
          user_id: latestReview?.reviewed_by?.user_id ?? null,
          name: latestReview?.reviewed_by?.full_name ?? null,
        },
        notes: null,
      },
      audit_integrity: {
        data_sources: ["prisma"],
        notes: "This report is generated from system-of-record event data where available.",
        report_id: reportId,
        hash: null,
      },
      not_available: notAvailable,
    };
  }
}
