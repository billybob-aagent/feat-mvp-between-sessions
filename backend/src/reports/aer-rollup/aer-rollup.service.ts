import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { UserRole } from "@prisma/client";

type AerRollupReport = {
  meta: {
    report_type: "AER_ROLLUP";
    version: "v1";
    generated_at: string;
    period: { start: string; end: string };
    clinic_id: string;
    program: string | null;
  };
  summary: {
    clients_in_scope: number;
    interventions_assigned: number;
    completed: number;
    partial: number;
    missed: number;
    late: number;
    completion_rate: number;
    noncompliance_rate: number;
  };
  client_rows: Array<{
    client_id: string;
    display_id: string | null;
    assigned: number;
    completed: number;
    partial: number;
    missed: number;
    late: number;
    completion_rate: number;
    last_activity_at: string | null;
    risk_flag: "ok" | "watch" | "high";
  }>;
  not_available: string[];
};

type ClientRow = {
  id: string;
  user_id: string;
};

type AssignmentRow = {
  id: string;
  client_id: string;
  created_at: Date;
  published_at: Date | null;
  due_date: Date | null;
};

type ResponseRow = {
  id: string;
  client_id: string;
  assignment_id: string;
  created_at: Date;
};

type CheckinRow = {
  client_id: string;
  created_at: Date;
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const roundRate = (numerator: number, denominator: number) => {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
};

@Injectable()
export class AerRollupService {
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

  async generateRollup(params: {
    clinicId: string;
    start: Date;
    end: Date;
    program: string | null;
    limit: number;
    cursor: string | null;
  }): Promise<AerRollupReport> {
    const { clinicId, start, end, program, limit, cursor } = params;
    const notAvailable: string[] = [];
    const addNotAvailable = (entry: string) => {
      if (!notAvailable.includes(entry)) notAvailable.push(entry);
    };

    if (program) {
      addNotAvailable("program filter (no program field to filter assignments/clients)");
    }
    if (cursor) {
      addNotAvailable("pagination cursor not implemented in v1");
    }

    addNotAvailable("client_rows.display_id (no display_id in clients table)");
    addNotAvailable("partial completion (no partial completion model)");

    const clinic = await this.prisma.clinics.findUnique({
      where: { id: clinicId },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");

    const clients = (await this.prisma.clients.findMany({
      where: { therapist: { clinic_id: clinicId } },
      select: { id: true, user_id: true },
    })) as ClientRow[];

    const clientIds = clients.map((client) => client.id);

    const periodFilter = { gte: start, lte: end };

    const assignments = (await this.prisma.assignments.findMany({
      where: {
        therapist: { clinic_id: clinicId },
        client_id: { in: clientIds.length > 0 ? clientIds : ["__none__"] },
        OR: [
          { created_at: periodFilter },
          { published_at: periodFilter },
          { due_date: periodFilter },
          { responses: { some: { created_at: periodFilter } } },
        ],
      },
      select: {
        id: true,
        client_id: true,
        created_at: true,
        published_at: true,
        due_date: true,
      },
    })) as AssignmentRow[];

    const responses = (await this.prisma.responses.findMany({
      where: {
        client_id: { in: clientIds.length > 0 ? clientIds : ["__none__"] },
        created_at: periodFilter,
        assignment: { therapist: { clinic_id: clinicId } },
      },
      select: {
        id: true,
        client_id: true,
        assignment_id: true,
        created_at: true,
      },
    })) as ResponseRow[];

    const checkins = (await this.prisma.checkins.findMany({
      where: {
        client_id: { in: clientIds.length > 0 ? clientIds : ["__none__"] },
        created_at: periodFilter,
      },
      select: {
        client_id: true,
        created_at: true,
      },
    })) as CheckinRow[];

    const responsesByAssignment = new Map<string, ResponseRow[]>();
    const lastActivityByClient = new Map<string, Date>();

    for (const response of responses) {
      const list = responsesByAssignment.get(response.assignment_id) ?? [];
      list.push(response);
      responsesByAssignment.set(response.assignment_id, list);

      const last = lastActivityByClient.get(response.client_id);
      if (!last || response.created_at > last) {
        lastActivityByClient.set(response.client_id, response.created_at);
      }
    }

    for (const checkin of checkins) {
      const last = lastActivityByClient.get(checkin.client_id);
      if (!last || checkin.created_at > last) {
        lastActivityByClient.set(checkin.client_id, checkin.created_at);
      }
    }

    const clientStats = new Map<
      string,
      {
        client_id: string;
        display_id: string | null;
        assigned: number;
        completed: number;
        partial: number;
        missed: number;
        late: number;
        completion_rate: number;
        last_activity_at: string | null;
        risk_flag: "ok" | "watch" | "high";
      }
    >();

    for (const client of clients) {
      clientStats.set(client.id, {
        client_id: client.id,
        display_id: null,
        assigned: 0,
        completed: 0,
        partial: 0,
        missed: 0,
        late: 0,
        completion_rate: 0,
        last_activity_at: null,
        risk_flag: "ok",
      });
    }

    for (const assignment of assignments) {
      const stats = clientStats.get(assignment.client_id);
      if (!stats) continue;
      stats.assigned += 1;

      const responsesForAssignment = responsesByAssignment.get(assignment.id) ?? [];
      if (responsesForAssignment.length > 0) {
        stats.completed += 1;
        const earliest = responsesForAssignment
          .slice()
          .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0];
        if (assignment.due_date && earliest && earliest.created_at > assignment.due_date) {
          stats.late += 1;
        }
      } else if (assignment.due_date && assignment.due_date <= end) {
        stats.missed += 1;
      }
    }

    let missingRiskInputs = false;

    for (const stats of clientStats.values()) {
      stats.completion_rate = roundRate(stats.completed, stats.assigned);
      const last = lastActivityByClient.get(stats.client_id) ?? null;
      stats.last_activity_at = last ? last.toISOString() : null;

      if (stats.assigned === 0) {
        stats.risk_flag = "ok";
        missingRiskInputs = true;
      } else if (stats.missed >= 2 || stats.completion_rate < 0.5) {
        stats.risk_flag = "high";
      } else if (stats.missed === 1 || stats.completion_rate < 0.75) {
        stats.risk_flag = "watch";
      } else {
        stats.risk_flag = "ok";
      }
    }

    if (missingRiskInputs) {
      addNotAvailable("risk_flag (insufficient data: no assigned interventions)");
    }

    const riskOrder: Record<string, number> = {
      high: 0,
      watch: 1,
      ok: 2,
    };

    const client_rows = Array.from(clientStats.values())
      .sort((a, b) => {
        const riskDiff = riskOrder[a.risk_flag] - riskOrder[b.risk_flag];
        if (riskDiff !== 0) return riskDiff;
        if (a.completion_rate !== b.completion_rate) {
          return a.completion_rate - b.completion_rate;
        }
        return a.client_id.localeCompare(b.client_id);
      })
      .slice(0, limit);

    const totals = Array.from(clientStats.values()).reduce(
      (acc, row) => {
        acc.assigned += row.assigned;
        acc.completed += row.completed;
        acc.partial += row.partial;
        acc.missed += row.missed;
        acc.late += row.late;
        return acc;
      },
      { assigned: 0, completed: 0, partial: 0, missed: 0, late: 0 },
    );

    const summary = {
      clients_in_scope: clients.length,
      interventions_assigned: totals.assigned,
      completed: totals.completed,
      partial: totals.partial,
      missed: totals.missed,
      late: totals.late,
      completion_rate: roundRate(totals.completed, totals.assigned),
      noncompliance_rate: roundRate(totals.missed + totals.late, totals.assigned),
    };

    return {
      meta: {
        report_type: "AER_ROLLUP",
        version: "v1",
        generated_at: new Date().toISOString(),
        period: { start: toIsoDate(start), end: toIsoDate(end) },
        clinic_id: clinicId,
        program,
      },
      summary,
      client_rows,
      not_available: notAvailable,
    };
  }
}
