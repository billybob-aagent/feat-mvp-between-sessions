import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SupervisorEscalationReason,
  SupervisorEscalationStatus,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../modules/prisma/prisma.service";
import { AuditService } from "../modules/audit/audit.service";
import {
  buildDateRangeFromParts,
  buildStorageDateFromParts,
  dateOnlyPartsFromUTC,
  formatDateOnly,
  parseDateOnly,
} from "../reports/aer/aer-report.utils";
import { computeSla, OVERDUE_THRESHOLD_HOURS } from "./sla.utils";

@Injectable()
export class SupervisorActionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private parseDateOnlyOrThrow(value: string) {
    const trimmed = value.trim();
    const parts = parseDateOnly(trimmed);
    if (!parts) {
      throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
    }
    return { parts, label: trimmed };
  }

  private async ensureClinicAccess(userId: string, role: UserRole, clinicId: string) {
    if (role === UserRole.admin) return;
    const membership = await this.prisma.clinic_memberships.findFirst({
      where: { user_id: userId, clinic_id: clinicId },
    });
    if (!membership) {
      throw new ForbiddenException("Clinic membership required");
    }
  }

  async createEscalation(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
    reason: SupervisorEscalationReason;
    note?: string | null;
    assignToTherapistId?: string | null;
    ip?: string;
    userAgent?: string;
  }) {
    const normalizedRole = String(params.role);
    if (normalizedRole !== UserRole.admin && normalizedRole !== UserRole.CLINIC_ADMIN) {
      throw new ForbiddenException("Insufficient role");
    }

    const startParsed = this.parseDateOnlyOrThrow(params.periodStart);
    const endParsed = this.parseDateOnlyOrThrow(params.periodEnd);

    const startRange = buildDateRangeFromParts(startParsed.parts);
    const endRange = buildDateRangeFromParts(endParsed.parts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("periodStart must be before periodEnd");
    }

    const clinic = await this.prisma.clinics.findUnique({
      where: { id: params.clinicId },
      select: { id: true },
    });
    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);

    const client = await this.prisma.clients.findUnique({
      where: { id: params.clientId },
      select: { id: true, therapist: { select: { clinic_id: true } } },
    });
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    if (client.therapist?.clinic_id !== params.clinicId) {
      throw new ForbiddenException("Client does not belong to clinic");
    }

    const assignToTherapistId = params.assignToTherapistId?.trim() || null;
    if (assignToTherapistId) {
      const therapist = await this.prisma.therapists.findUnique({
        where: { id: assignToTherapistId },
        select: { id: true, clinic_id: true },
      });
      if (!therapist || therapist.clinic_id !== params.clinicId) {
        throw new BadRequestException("Assigned therapist not found for clinic");
      }
    }

    const escalation = await this.prisma.supervisor_escalations.create({
      data: {
        clinic_id: params.clinicId,
        client_id: params.clientId,
        period_start: buildStorageDateFromParts(startParsed.parts),
        period_end: buildStorageDateFromParts(endParsed.parts),
        reason: params.reason,
        note: params.note?.trim() || null,
        created_by_user_id: params.userId,
        assign_to_therapist_id: assignToTherapistId,
        status: SupervisorEscalationStatus.OPEN,
      },
      select: { id: true, created_at: true },
    });

    await this.audit.log({
      userId: params.userId,
      action: "SUPERVISOR_ESCALATION_CREATED",
      entityType: "supervisor_escalation",
      entityId: escalation.id,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: {
        clinicId: params.clinicId,
        clientId: params.clientId,
        periodStart: startParsed.label,
        periodEnd: endParsed.label,
        reason: params.reason,
      },
    });

    // TODO: enqueue a supervisor escalation notification if/when a dedicated notification type exists.

    return {
      ok: true,
      escalationId: escalation.id,
      createdAt: escalation.created_at.toISOString(),
    };
  }

  async resolveEscalation(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    escalationId: string;
    note?: string | null;
    ip?: string;
    userAgent?: string;
  }) {
    const normalizedRole = String(params.role);
    if (normalizedRole !== UserRole.admin && normalizedRole !== UserRole.CLINIC_ADMIN) {
      throw new ForbiddenException("Insufficient role");
    }

    const clinic = await this.prisma.clinics.findUnique({
      where: { id: params.clinicId },
      select: { id: true },
    });
    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);

    const escalation = await this.prisma.supervisor_escalations.findUnique({
      where: { id: params.escalationId },
    });
    if (!escalation) {
      throw new NotFoundException("Escalation not found");
    }
    if (escalation.clinic_id !== params.clinicId) {
      throw new ForbiddenException("Escalation does not belong to clinic");
    }
    if (escalation.status === SupervisorEscalationStatus.RESOLVED) {
      throw new ConflictException("Escalation already resolved");
    }

    const resolvedAt = new Date();
    const updated = await this.prisma.supervisor_escalations.update({
      where: { id: escalation.id },
      data: {
        status: SupervisorEscalationStatus.RESOLVED,
        resolved_at: resolvedAt,
      },
      select: { id: true, resolved_at: true },
    });

    await this.audit.log({
      userId: params.userId,
      action: "SUPERVISOR_ESCALATION_RESOLVED",
      entityType: "supervisor_escalation",
      entityId: updated.id,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: {
        clinicId: params.clinicId,
        clientId: escalation.client_id,
        periodStart: formatDateOnly(dateOnlyPartsFromUTC(escalation.period_start)),
        periodEnd: formatDateOnly(dateOnlyPartsFromUTC(escalation.period_end)),
        reason: escalation.reason,
        note: params.note?.trim() || null,
      },
    });

    return {
      ok: true,
      escalationId: updated.id,
      status: SupervisorEscalationStatus.RESOLVED,
      resolvedAt: updated.resolved_at?.toISOString() ?? resolvedAt.toISOString(),
    };
  }

  async updateEscalationNote(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    escalationId: string;
    note?: string | null;
    source?: string | null;
    ip?: string;
    userAgent?: string;
  }) {
    const normalizedRole = String(params.role);
    if (normalizedRole !== UserRole.admin && normalizedRole !== UserRole.CLINIC_ADMIN) {
      throw new ForbiddenException("Insufficient role");
    }

    const clinic = await this.prisma.clinics.findUnique({
      where: { id: params.clinicId },
      select: { id: true },
    });
    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);

    const escalation = await this.prisma.supervisor_escalations.findUnique({
      where: { id: params.escalationId },
    });
    if (!escalation) {
      throw new NotFoundException("Escalation not found");
    }
    if (escalation.clinic_id !== params.clinicId) {
      throw new ForbiddenException("Escalation does not belong to clinic");
    }

    const noteValue = params.note?.trim();
    const updated = await this.prisma.supervisor_escalations.update({
      where: { id: escalation.id },
      data: { note: noteValue ? noteValue : null },
      select: { id: true, note: true },
    });

    await this.audit.log({
      userId: params.userId,
      action: "SUPERVISOR_ESCALATION_NOTE_UPDATED",
      entityType: "supervisor_escalation",
      entityId: updated.id,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: {
        clinicId: params.clinicId,
        clientId: escalation.client_id,
        escalationId: updated.id,
        periodStart: formatDateOnly(dateOnlyPartsFromUTC(escalation.period_start)),
        periodEnd: formatDateOnly(dateOnlyPartsFromUTC(escalation.period_end)),
        note: updated.note,
      },
    });

    if (params.source === "ai_draft") {
      await this.audit.log({
        userId: params.userId,
        action: "ai.draft.apply",
        entityType: "clinic",
        entityId: params.clinicId,
        ip: params.ip,
        userAgent: params.userAgent,
        metadata: {
          clinicId: params.clinicId,
          clientId: escalation.client_id,
          escalationId: updated.id,
          source: params.source,
        },
      });
    }

    return {
      ok: true,
      escalationId: updated.id,
      note: updated.note ?? null,
    };
  }

  async listEscalations(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    status: "OPEN" | "RESOLVED" | "ALL";
    start?: string;
    end?: string;
    limit: number;
  }) {
    const normalizedRole = String(params.role);
    if (normalizedRole !== UserRole.admin && normalizedRole !== UserRole.CLINIC_ADMIN) {
      throw new ForbiddenException("Insufficient role");
    }

    const clinic = await this.prisma.clinics.findUnique({
      where: { id: params.clinicId },
      select: { id: true },
    });
    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);

    const where: Record<string, any> = {
      clinic_id: params.clinicId,
    };

    if (params.status !== "ALL") {
      where.status = params.status;
    }

    if (params.start) {
      const startParsed = this.parseDateOnlyOrThrow(params.start);
      where.period_start = {
        ...(where.period_start || {}),
        gte: buildStorageDateFromParts(startParsed.parts),
      };
    }
    if (params.end) {
      const endParsed = this.parseDateOnlyOrThrow(params.end);
      where.period_end = {
        ...(where.period_end || {}),
        lte: buildStorageDateFromParts(endParsed.parts),
      };
    }

    const rows = await this.prisma.supervisor_escalations.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      take: params.limit,
    });

    const now = new Date();

    const mapped = rows.map((row) => {
      const createdAt = row.created_at;
      const resolvedAt = row.resolved_at;
      const sla = computeSla({
        createdAt,
        resolvedAt,
        status: row.status,
        now,
      });

      return {
        id: row.id,
        clientId: row.client_id,
        therapistId: row.assign_to_therapist_id ?? null,
        reason: row.reason,
        periodStart: formatDateOnly(dateOnlyPartsFromUTC(row.period_start)),
        periodEnd: formatDateOnly(dateOnlyPartsFromUTC(row.period_end)),
        status: row.status,
        createdAt: createdAt.toISOString(),
        resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
        sla: {
          time_to_resolve_hours: sla.timeToResolveHours,
          age_hours: sla.ageHours,
          overdue: sla.overdue,
        },
      };
    });

    return {
      ok: true,
      clinicId: params.clinicId,
      rows: mapped,
      sla_defaults: {
        overdue_threshold_hours: OVERDUE_THRESHOLD_HOURS,
      },
    };
  }
}
