import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AerReportService } from "../../reports/aer/aer-report.service";
import { AerPdfService } from "../../reports/aer/pdf/aer-pdf.service";
import {
  buildDateRangeFromParts,
  buildStorageDateFromParts,
  dateOnlyPartsFromUTC,
  formatDateOnly,
  parseDateOnly,
} from "../../reports/aer/aer-report.utils";

const MAX_TTL_MINUTES = 60 * 24 * 7;

type ReportType = "AER_PDF" | "AER_JSON";

type TokenUseMeta = {
  ip?: string;
  userAgent?: string;
  path: string;
};

type PeriodRange = {
  startLabel: string;
  endLabel: string;
  start: Date;
  end: Date;
  startParts: { year: number; month: number; day: number };
  endParts: { year: number; month: number; day: number };
};

@Injectable()
export class ExternalAccessService {
  constructor(
    private prisma: PrismaService,
    private aerReport: AerReportService,
    private aerPdf: AerPdfService,
  ) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private parseDateLabel(value: string) {
    const trimmed = value.trim();
    const parts = parseDateOnly(trimmed);
    if (!parts) {
      throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
    }
    return { parts, label: trimmed };
  }

  private buildPeriodRange(startLabel: string, endLabel: string): PeriodRange {
    const startParsed = this.parseDateLabel(startLabel);
    const endParsed = this.parseDateLabel(endLabel);

    const startRange = buildDateRangeFromParts(startParsed.parts);
    const endRange = buildDateRangeFromParts(endParsed.parts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("Start date must be before end date");
    }

    return {
      startLabel: startParsed.label,
      endLabel: endParsed.label,
      start: startRange.start,
      end: endRange.end,
      startParts: startParsed.parts,
      endParts: endParsed.parts,
    };
  }

  private buildPeriodRangeFromToken(token: { period_start: Date; period_end: Date }) {
    const startParts = dateOnlyPartsFromUTC(token.period_start);
    const endParts = dateOnlyPartsFromUTC(token.period_end);
    const startLabel = formatDateOnly(startParts);
    const endLabel = formatDateOnly(endParts);
    const startRange = buildDateRangeFromParts(startParts);
    const endRange = buildDateRangeFromParts(endParts);

    if (startRange.start > endRange.end) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    return {
      startLabel,
      endLabel,
      start: startRange.start,
      end: endRange.end,
      startParts,
      endParts,
    };
  }

  private async ensureClinicAccess(userId: string, role: UserRole, clinicId: string) {
    if (String(role).toLowerCase() === "admin") return;

    const membership = await this.prisma.clinic_memberships.findFirst({
      where: { user_id: userId, clinic_id: clinicId },
    });

    if (!membership) {
      throw new ForbiddenException("Clinic membership required");
    }
  }

  private normalizeProgram(program?: string | null) {
    const trimmed = program?.trim();
    return trimmed ? trimmed : null;
  }

  private async logTokenUse(tokenId: string, meta: TokenUseMeta, statusCode: number) {
    await this.prisma.external_access_token_uses.create({
      data: {
        token_id: tokenId,
        ip: meta.ip ?? null,
        user_agent: meta.userAgent ?? null,
        path: meta.path,
        status_code: statusCode,
      },
    });
  }

  async createAerToken(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    clientId: string;
    start: string;
    end: string;
    program?: string | null;
    format: "pdf" | "json";
    ttlMinutes?: number;
  }) {
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

    const periodRange = this.buildPeriodRange(params.start, params.end);
    const periodStart = buildStorageDateFromParts(periodRange.startParts);
    const periodEnd = buildStorageDateFromParts(periodRange.endParts);

    const requestedTtl = params.ttlMinutes ?? 60;
    const ttlMinutes = Math.min(Math.max(requestedTtl, 1), MAX_TTL_MINUTES);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const token = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);
    const reportType: ReportType = params.format === "pdf" ? "AER_PDF" : "AER_JSON";

    const created = await this.prisma.external_access_tokens.create({
      data: {
        token_hash: tokenHash,
        clinic_id: params.clinicId,
        client_id: params.clientId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        program: this.normalizeProgram(params.program),
        expires_at: expiresAt,
        created_by_user_id: params.userId,
      },
    });

    return {
      token_id: created.id,
      report_type: created.report_type,
      expires_at: created.expires_at.toISOString(),
      url: `/api/v1/external/aer.${params.format}?token=${token}`,
    };
  }

  async revokeToken(params: { userId: string; role: UserRole; tokenId: string }) {
    const token = await this.prisma.external_access_tokens.findUnique({
      where: { id: params.tokenId },
    });

    if (!token) {
      throw new NotFoundException("Token not found");
    }

    await this.ensureClinicAccess(params.userId, params.role, token.clinic_id);

    const revokedAt = token.revoked_at ?? new Date();

    const updated = await this.prisma.external_access_tokens.update({
      where: { id: token.id },
      data: { revoked_at: revokedAt },
    });

    return {
      token_id: updated.id,
      revoked_at: updated.revoked_at?.toISOString() ?? null,
    };
  }

  async getAerJsonFromToken(rawToken: string | undefined, meta: TokenUseMeta) {
    return this.useToken(rawToken, "AER_JSON", meta, async (token, period) =>
      this.aerReport.generateAerReport(
        token.clinic_id,
        token.client_id ?? "",
        period.start,
        period.end,
        token.program ?? undefined,
        {
          periodStartLabel: period.startLabel,
          periodEndLabel: period.endLabel,
        },
      ),
    );
  }

  async getAerPdfFromToken(rawToken: string | undefined, meta: TokenUseMeta) {
    return this.useToken(rawToken, "AER_PDF", meta, async (token, period) =>
      this.aerPdf.generatePdfReport(
        token.clinic_id,
        token.client_id ?? "",
        period.start,
        period.end,
        token.program ?? undefined,
        {
          periodStartLabel: period.startLabel,
          periodEndLabel: period.endLabel,
        },
      ),
    );
  }

  private async useToken<T>(
    rawToken: string | undefined,
    reportType: ReportType,
    meta: TokenUseMeta,
    handler: (
      token: {
        id: string;
        clinic_id: string;
        client_id: string | null;
        report_type: string;
        period_start: Date;
        period_end: Date;
        program: string | null;
        expires_at: Date;
        revoked_at: Date | null;
      },
      period: PeriodRange,
    ) => Promise<T>,
  ): Promise<T> {
    const tokenValue = rawToken?.trim();
    if (!tokenValue) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const token = await this.prisma.external_access_tokens.findFirst({
      where: {
        token_hash: this.hashToken(tokenValue),
        report_type: reportType,
      },
    });

    if (!token || !token.client_id) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const now = new Date();
    if (token.revoked_at || token.expires_at <= now) {
      await this.logTokenUse(token.id, meta, 401);
      throw new UnauthorizedException("Invalid or expired token");
    }

    const period = this.buildPeriodRangeFromToken(token);

    try {
      const result = await handler(token, period);
      await this.logTokenUse(token.id, meta, 200);
      return result;
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500;
      await this.logTokenUse(token.id, meta, status);
      throw error;
    }
  }
}
