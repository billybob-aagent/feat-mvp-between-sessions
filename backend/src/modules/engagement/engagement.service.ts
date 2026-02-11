import { Injectable, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { SupervisorActionsService } from "../../supervisor-actions/supervisor-actions.service";
import {
  buildEngagementAuditMetadata,
  DEFAULT_ENGAGEMENT_THRESHOLDS,
  EngagementResponseInput,
  formatDateOnlyInTimeZone,
  getEscalationDecision,
  summarizeEngagement,
  toEngagementKey,
  deriveEngagementTransitions,
  shouldSendFirstNudge,
} from "./engagement.utils";

const dedupeNudgeKey = (assignmentId: string) =>
  `assignment:${assignmentId}:nudge:first`;

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private supervisorActions: SupervisorActionsService,
  ) {}

  async runAutomation(params: {
    assignmentIds?: string[];
    clinicId?: string | null;
    limit?: number;
    now?: Date;
    dryRun?: boolean;
  }) {
    const now = params.now ?? new Date();
    const dryRun = Boolean(params.dryRun);

    const assignmentIds = (params.assignmentIds ?? []).filter(Boolean);

    const where: Record<string, any> = {
      status: "published",
    };

    if (assignmentIds.length > 0) {
      where.id = { in: assignmentIds };
    }

    if (params.clinicId) {
      where.therapist = { clinic_id: params.clinicId };
    }

    const assignments = await this.prisma.assignments.findMany({
      where,
      take: params.limit ? Math.max(params.limit, 1) : undefined,
      select: {
        id: true,
        title: true,
        created_at: true,
        published_at: true,
        due_date: true,
        therapist_id: true,
        client_id: true,
        prompt: { select: { title: true } },
        therapist: { select: { user_id: true, clinic_id: true } },
        client: {
          select: {
            user_id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (assignments.length === 0) {
      return { processed: 0, nudgesSent: 0, escalationsCreated: 0, transitionsLogged: 0 };
    }

    const ids = assignments.map((assignment) => assignment.id);

    const responses = await this.prisma.responses.findMany({
      where: { assignment_id: { in: ids } },
      select: {
        assignment_id: true,
        created_at: true,
        completion_status: true,
      },
    });

    const responsesByAssignment = new Map<string, EngagementResponseInput[]>();
    for (const response of responses) {
      const list = responsesByAssignment.get(response.assignment_id) ?? [];
      list.push({
        createdAt: response.created_at,
        completionStatus: response.completion_status,
      });
      responsesByAssignment.set(response.assignment_id, list);
    }

    const clinicIds = Array.from(
      new Set(assignments.map((assignment) => assignment.therapist?.clinic_id).filter(Boolean)),
    ) as string[];

    const clinics = clinicIds.length
      ? await this.prisma.clinics.findMany({
          where: { id: { in: clinicIds } },
          select: { id: true, timezone: true },
        })
      : [];

    const clinicTimezones = new Map(clinics.map((row) => [row.id, row.timezone]));

    const memberships = clinicIds.length
      ? await this.prisma.clinic_memberships.findMany({
          where: { clinic_id: { in: clinicIds } },
          select: { clinic_id: true, user_id: true },
        })
      : [];

    const clinicAdminMap = new Map<string, string>();
    for (const membership of memberships) {
      const existing = clinicAdminMap.get(membership.clinic_id);
      if (!existing || membership.user_id.localeCompare(existing) < 0) {
        clinicAdminMap.set(membership.clinic_id, membership.user_id);
      }
    }

    const existingLogs = await this.prisma.audit_logs.findMany({
      where: {
        action: "assignment.engagement.state_change",
        entity_type: "assignment",
        entity_id: { in: ids },
      },
      select: { entity_id: true, metadata: true },
    });

    const loggedByAssignment = new Map<string, Set<string>>();
    for (const log of existingLogs) {
      const key = log.entity_id ?? "";
      if (!key) continue;
      const metadata = (log.metadata as Record<string, any>) ?? {};
      const toState = typeof metadata.to_state === "string" ? metadata.to_state : "";
      const effectiveAt = typeof metadata.effective_at === "string" ? metadata.effective_at : "";
      if (!toState || !effectiveAt) continue;
      const entryKey = `${toState}:${effectiveAt}`;
      const set = loggedByAssignment.get(key) ?? new Set<string>();
      set.add(entryKey);
      loggedByAssignment.set(key, set);
    }

    const openEscalations = await this.prisma.supervisor_escalations.findMany({
      where: {
        status: "OPEN",
        source_assignment_id: { in: ids },
      },
      select: { source_assignment_id: true },
    });

    const openEscalationByAssignment = new Set(
      openEscalations.map((row) => row.source_assignment_id).filter(Boolean) as string[],
    );

    let nudgesSent = 0;
    let escalationsCreated = 0;
    let transitionsLogged = 0;

    for (const assignment of assignments) {
      const clinicId = assignment.therapist?.clinic_id ?? null;
      const timeZone = clinicId ? clinicTimezones.get(clinicId) ?? "UTC" : "UTC";
      const responsesForAssignment = responsesByAssignment.get(assignment.id) ?? [];

      const summary = summarizeEngagement({
        createdAt: assignment.created_at,
        publishedAt: assignment.published_at,
        dueDate: assignment.due_date,
        responses: responsesForAssignment,
        clinicTimezone: timeZone,
        now,
        thresholds: DEFAULT_ENGAGEMENT_THRESHOLDS,
      });

      const transitions = deriveEngagementTransitions({
        summary,
        now,
        thresholds: DEFAULT_ENGAGEMENT_THRESHOLDS,
      });

      const loggedSet = loggedByAssignment.get(assignment.id) ?? new Set<string>();
      for (const transition of transitions) {
        const key = toEngagementKey(transition);
        if (loggedSet.has(key)) continue;
        if (!dryRun) {
          try {
            await this.audit.log({
              userId: assignment.therapist?.user_id ?? undefined,
              action: "assignment.engagement.state_change",
              entityType: "assignment",
              entityId: assignment.id,
              metadata: buildEngagementAuditMetadata(transition),
            });
            transitionsLogged += 1;
          } catch (err) {
            this.logger.error(
              `Failed to audit engagement transition for assignment ${assignment.id}.`,
              err instanceof Error ? err.message : String(err),
            );
          }
        }
        loggedSet.add(key);
      }
      if (!loggedByAssignment.has(assignment.id)) {
        loggedByAssignment.set(assignment.id, loggedSet);
      }

      if (!dryRun && shouldSendFirstNudge({ summary, now })) {
        const clientUserId = assignment.client?.user_id;
        if (!clientUserId) {
          this.logger.warn(`Skipping nudge for assignment ${assignment.id} (missing client user).`);
        } else {
          const title = assignment.title ?? assignment.prompt?.title ?? "Assignment";
          const dueDate = summary.dueAt ? summary.dueAt.toISOString() : null;
          const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
          const url = `${baseUrl}/app/client/assignments/${assignment.id}`;
          try {
            const result = await this.notifications.notifyUser({
              userId: clientUserId,
              type: "assignment_nudge_first",
              dedupeKey: dedupeNudgeKey(assignment.id),
              payload: {
                kind: "assignment_nudge_first",
                title: "Check-in ready",
                body: `Your check-in "${title}" is ready when you are.`,
                url,
                assignmentId: assignment.id,
                dueDate,
              },
              emailTo: assignment.client?.user?.email ?? null,
              emailSubject: "Check-in ready",
              emailText: `Your check-in "${title}" is ready when you are. Open: ${url}`,
              emailHtml: `<p>Your check-in <strong>${title}</strong> is ready when you are.</p><p><a href="${url}">Open check-in</a></p>`,
            });
            if (result.created) nudgesSent += 1;
          } catch (err) {
            this.logger.error(
              `Failed to send engagement nudge for assignment ${assignment.id}.`,
              err instanceof Error ? err.message : String(err),
            );
          }
        }
      }

      const escalationDecision = getEscalationDecision({ summary, now });
      if (!dryRun && escalationDecision && clinicId) {
        if (openEscalationByAssignment.has(assignment.id)) {
          continue;
        }
        const escalationActor = clinicAdminMap.get(clinicId);
        if (!escalationActor) {
          this.logger.warn(`Skipping escalation for assignment ${assignment.id} (no clinic admin).`);
          continue;
        }
        const assignmentStart = summary.assignmentStartAt;
        const periodEndCandidate = summary.dueAt ?? summary.lastResponseAt ?? assignmentStart;
        const rangeStart =
          assignmentStart.getTime() <= periodEndCandidate.getTime()
            ? assignmentStart
            : periodEndCandidate;
        const rangeEnd =
          assignmentStart.getTime() <= periodEndCandidate.getTime()
            ? periodEndCandidate
            : assignmentStart;
        const periodStart = formatDateOnlyInTimeZone(rangeStart, timeZone);
        const periodEnd = formatDateOnlyInTimeZone(rangeEnd, timeZone);

        try {
          await this.supervisorActions.createEscalation({
            userId: escalationActor,
            role: UserRole.CLINIC_ADMIN,
            clinicId,
            clientId: assignment.client_id,
            periodStart,
            periodEnd,
            reason: escalationDecision.reason,
            note: `Automated escalation (${escalationDecision.trigger}).`,
            assignToTherapistId: assignment.therapist_id,
            sourceAssignmentId: assignment.id,
          });
          openEscalationByAssignment.add(assignment.id);
          escalationsCreated += 1;
        } catch (err) {
          this.logger.error(
            `Failed to create escalation for assignment ${assignment.id}.`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

    }

    return {
      processed: assignments.length,
      nudgesSent,
      escalationsCreated,
      transitionsLogged,
    };
  }
}
