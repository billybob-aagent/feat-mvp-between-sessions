import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AerRollupService } from "../aer-rollup/aer-rollup.service";
import { ExternalAccessService } from "../../modules/external-access/external-access.service";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { computeSla } from "../../supervisor-actions/sla.utils";
import {
  buildStorageDateFromParts,
  parseDateOnly,
} from "../aer/aer-report.utils";

const MAX_EXTERNAL_TTL_MINUTES = 1440;

const clampInt = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type SupervisorWeeklyPacket = {
  meta: {
    report_type: "SUPERVISOR_WEEKLY_PACKET";
    version: "v1";
    generated_at: string;
    period: { start: string; end: string };
    clinic_id: string;
    program: string | null;
    top: number;
    include_external_links: boolean;
  };
  rollup: Awaited<ReturnType<AerRollupService["generateRollup"]>>;
  top_risk_clients: Array<{
    rank: number;
    client_id: string;
    display_id: string | null;
    risk_flag: "high" | "watch" | "ok";
    completion_rate: number;
    missed: number;
    last_activity_at: string | null;
    internal_links: {
      aer_json: string;
      aer_pdf: string;
    };
    external_links: {
      aer_json: string;
      aer_pdf: string;
    } | null;
    escalation: {
      status: "OPEN" | "RESOLVED" | "NONE";
      overdue: boolean | null;
      escalation_id: string | null;
    };
  }>;
  escalations: {
    open_count: number;
    overdue_count: number;
    rows: Array<{
      escalation_id: string;
      client_id: string;
      reason: string;
      status: "OPEN" | "RESOLVED";
      created_at: string;
      sla: {
        age_hours: number;
        overdue: boolean;
      };
      links: {
        resolve: string;
      };
    }>;
  };
  not_available: string[];
};

@Injectable()
export class SupervisorWeeklyPacketService {
  constructor(
    private aerRollup: AerRollupService,
    private externalAccess: ExternalAccessService,
    private prisma: PrismaService,
  ) {}

  async generatePacket(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    startLabel: string;
    endLabel: string;
    start: Date;
    end: Date;
    program: string | null;
    top: number;
    includeExternalLinks: boolean;
    externalTtlMinutes: number;
    nowOverride?: Date;
    generatedAtOverride?: Date;
  }): Promise<SupervisorWeeklyPacket> {
    const {
      userId,
      role,
      clinicId,
      startLabel,
      endLabel,
      start,
      end,
      program,
      top,
      includeExternalLinks,
      externalTtlMinutes,
    } = params;

    await this.aerRollup.ensureClinicAccess(userId, role, clinicId);

    if (includeExternalLinks) {
      const normalizedRole = String(role);
      if (normalizedRole !== UserRole.admin && normalizedRole !== UserRole.CLINIC_ADMIN) {
        throw new ForbiddenException("Insufficient role for external link generation");
      }
    }

    const rollup = await this.aerRollup.generateRollup({
      clinicId,
      start,
      end,
      program,
      limit: Number.MAX_SAFE_INTEGER,
      cursor: null,
    });

    const notAvailable = [...rollup.not_available];
    if (rollup.client_rows.length < rollup.summary.clients_in_scope) {
      notAvailable.push(
        `top_risk_clients limited to ${rollup.client_rows.length} clients from rollup`,
      );
    }

    const riskOrder: Record<string, number> = {
      high: 0,
      watch: 1,
      ok: 2,
    };

    const sorted = [...rollup.client_rows].sort((a, b) => {
      const riskDiff = riskOrder[a.risk_flag] - riskOrder[b.risk_flag];
      if (riskDiff !== 0) return riskDiff;
      if (a.completion_rate !== b.completion_rate) {
        return a.completion_rate - b.completion_rate;
      }
      if (a.missed !== b.missed) {
        return b.missed - a.missed;
      }
      return a.client_id.localeCompare(b.client_id);
    });

    const topRows = sorted.slice(0, top);

    const query = new URLSearchParams({
      start: startLabel,
      end: endLabel,
    });
    if (program) {
      query.set("program", program);
    }
    const queryString = query.toString();

    const ttl = clampInt(externalTtlMinutes, 1, MAX_EXTERNAL_TTL_MINUTES);

    const top_risk_clients: SupervisorWeeklyPacket["top_risk_clients"] = [];

    const startParts = parseDateOnly(startLabel);
    const endParts = parseDateOnly(endLabel);
    if (!startParts || !endParts) {
      throw new BadRequestException("Invalid period range");
    }

    const escalationRowsRaw = await this.prisma.supervisor_escalations.findMany({
      where: {
        clinic_id: clinicId,
        period_start: { lte: buildStorageDateFromParts(endParts) },
        period_end: { gte: buildStorageDateFromParts(startParts) },
      },
    });

    const now = params.nowOverride ?? new Date();
    const escalationRows = escalationRowsRaw.map((row) => {
      const sla = computeSla({
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        status: row.status,
        now,
      });
      return {
        escalation_id: row.id,
        client_id: row.client_id,
        reason: row.reason,
        status: row.status,
        created_at: row.created_at.toISOString(),
        sla: {
          age_hours: sla.ageHours,
          overdue: sla.overdue,
        },
      };
    });

    escalationRows.sort((a, b) => {
      if (a.sla.overdue !== b.sla.overdue) {
        return a.sla.overdue ? -1 : 1;
      }
      const createdDiff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (createdDiff !== 0) return createdDiff;
      return a.escalation_id.localeCompare(b.escalation_id);
    });

    const open_count = escalationRows.filter((row) => row.status === "OPEN").length;
    const overdue_count = escalationRows.filter(
      (row) => row.status === "OPEN" && row.sla.overdue,
    ).length;

    const escalationByClient = new Map<string, typeof escalationRows>();
    for (const row of escalationRows) {
      const list = escalationByClient.get(row.client_id) ?? [];
      list.push(row);
      escalationByClient.set(row.client_id, list);
    }

    const pickEscalation = (rowsForClient: typeof escalationRows) => {
      const order: Record<string, number> = { OPEN: 0, RESOLVED: 1 };
      return rowsForClient
        .slice()
        .sort((a, b) => {
          const statusDiff = order[a.status] - order[b.status];
          if (statusDiff !== 0) return statusDiff;
          if (a.sla.overdue !== b.sla.overdue) {
            return a.sla.overdue ? -1 : 1;
          }
          const createdDiff =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          if (createdDiff !== 0) return createdDiff;
          return a.escalation_id.localeCompare(b.escalation_id);
        })[0];
    };

    for (let index = 0; index < topRows.length; index += 1) {
      const row = topRows[index];
      const internal_links = {
        aer_json: `/api/v1/reports/aer/${clinicId}/${row.client_id}?${queryString}`,
        aer_pdf: `/api/v1/reports/aer/${clinicId}/${row.client_id}.pdf?${queryString}`,
      };

      let external_links: SupervisorWeeklyPacket["top_risk_clients"][number]["external_links"] = null;
      if (includeExternalLinks) {
        const jsonToken = await this.externalAccess.createAerToken({
          userId,
          role,
          clinicId,
          clientId: row.client_id,
          start: startLabel,
          end: endLabel,
          program,
          format: "json",
          ttlMinutes: ttl,
        });
        const pdfToken = await this.externalAccess.createAerToken({
          userId,
          role,
          clinicId,
          clientId: row.client_id,
          start: startLabel,
          end: endLabel,
          program,
          format: "pdf",
          ttlMinutes: ttl,
        });

        external_links = {
          aer_json: jsonToken.url,
          aer_pdf: pdfToken.url,
        };
      }

      const escalationsForClient = escalationByClient.get(row.client_id) ?? [];
      const picked = escalationsForClient.length > 0 ? pickEscalation(escalationsForClient) : null;
      const escalation = picked
        ? {
            status: picked.status,
            overdue: picked.status === "OPEN" ? picked.sla.overdue : false,
            escalation_id: picked.escalation_id,
          }
        : {
            status: "NONE" as const,
            overdue: null,
            escalation_id: null,
          };

      top_risk_clients.push({
        rank: index + 1,
        client_id: row.client_id,
        display_id: row.display_id ?? null,
        risk_flag: row.risk_flag,
        completion_rate: row.completion_rate,
        missed: row.missed,
        last_activity_at: row.last_activity_at ?? null,
        internal_links,
        external_links,
        escalation,
      });
    }

    return {
      meta: {
        report_type: "SUPERVISOR_WEEKLY_PACKET",
        version: "v1",
        generated_at: (params.generatedAtOverride ?? new Date()).toISOString(),
        period: { start: startLabel, end: endLabel },
        clinic_id: clinicId,
        program,
        top,
        include_external_links: includeExternalLinks,
      },
      rollup,
      top_risk_clients,
      escalations: {
        open_count,
        overdue_count,
        rows: escalationRows.map((row) => ({
          escalation_id: row.escalation_id,
          client_id: row.client_id,
          reason: row.reason,
          status: row.status,
          created_at: row.created_at,
          sla: row.sla,
          links: {
            resolve: `/api/v1/supervisor-actions/escalate/${row.escalation_id}/resolve`,
          },
        })),
      },
      not_available: notAvailable,
    };
  }

  parseTop(value: string | undefined, defaultValue: number) {
    if (!value) return defaultValue;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException("Invalid top value");
    }
    return clampInt(parsed, 1, 50);
  }

  parseExternalTtl(value: string | undefined, defaultValue: number) {
    if (!value) return defaultValue;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException("Invalid externalTtlMinutes value");
    }
    return clampInt(parsed, 1, MAX_EXTERNAL_TTL_MINUTES);
  }
}
