import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as crypto from "node:crypto";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { AerReportService } from "../aer/aer-report.service";
import { AerPdfService } from "../aer/pdf/aer-pdf.service";
import { SupervisorWeeklyPacketService } from "../supervisor-weekly-packet/supervisor-weekly-packet.service";
import { ExternalAccessService } from "../../modules/external-access/external-access.service";
import { buildStorageDateFromParts, parseDateOnly } from "../aer/aer-report.utils";
import { FORBIDDEN_LANGUAGE, getSubmissionProfile, SubmissionProfileKey } from "./profiles";

const DEFAULT_EXTERNAL_TTL_MINUTES = 60;

@Injectable()
export class SubmissionBundleService {
  constructor(
    private prisma: PrismaService,
    private aerReport: AerReportService,
    private aerPdf: AerPdfService,
    private weeklyPacket: SupervisorWeeklyPacketService,
    private externalAccess: ExternalAccessService,
  ) {}

  private sha256(data: Buffer | string) {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private async ensureClientAccess(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
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
    if (!clinicId || clinicId !== params.clinicId) {
      throw new ForbiddenException("Client does not belong to clinic");
    }

    if (params.role === UserRole.admin) return { client, clinicId };

    if (params.role === UserRole.CLINIC_ADMIN) {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: params.userId, clinic_id: clinicId },
        select: { id: true },
      });
      if (!membership) throw new ForbiddenException("Clinic membership required");
      return { client, clinicId };
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
      return { client, clinicId };
    }

    throw new ForbiddenException("Access denied");
  }

  private formatLanguageBlock(lines: string[]) {
    return lines.map((line) => `- ${line}`).join("\n");
  }

  private createZip(
    files: Array<{ name: string; data: Buffer }>,
    generatedAt: Date,
  ): Buffer {
    const { dosDate, dosTime } = this.toDosDateTime(generatedAt);
    const fileRecords: Buffer[] = [];
    const centralRecords: Buffer[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBuf = Buffer.from(file.name, "utf8");
      const crc = this.crc32(file.data);
      const size = file.data.length;

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(size, 18);
      localHeader.writeUInt32LE(size, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);

      const localRecord = Buffer.concat([localHeader, nameBuf, file.data]);
      fileRecords.push(localRecord);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(dosTime, 12);
      centralHeader.writeUInt16LE(dosDate, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(size, 20);
      centralHeader.writeUInt32LE(size, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);

      const centralRecord = Buffer.concat([centralHeader, nameBuf]);
      centralRecords.push(centralRecord);

      offset += localRecord.length;
    }

    const centralDir = Buffer.concat(centralRecords);
    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(files.length, 8);
    endRecord.writeUInt16LE(files.length, 10);
    endRecord.writeUInt32LE(centralDir.length, 12);
    endRecord.writeUInt32LE(offset, 16);
    endRecord.writeUInt16LE(0, 20);

    return Buffer.concat([...fileRecords, centralDir, endRecord]);
  }

  private toDosDateTime(date: Date) {
    const year = Math.max(date.getUTCFullYear(), 1980);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = Math.floor(date.getUTCSeconds() / 2);
    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    return { dosDate, dosTime };
  }

  private crc32(buffer: Buffer) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buffer.length; i += 1) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  private parsePeriodLabel(value: string) {
    const parsed = parseDateOnly(value);
    if (!parsed) {
      throw new Error(`Invalid date format: ${value}`);
    }
    return parsed;
  }

  async generateBundle(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    clientId: string;
    startLabel: string;
    endLabel: string;
    start: Date;
    end: Date;
    profile: SubmissionProfileKey;
    includeWeeklyPacket?: boolean;
    includeEscalations?: boolean;
    includeExternalLinks?: boolean;
    externalTtlMinutes?: number;
  }) {
    const profile = getSubmissionProfile(params.profile);
    await this.ensureClientAccess({
      userId: params.userId,
      role: params.role,
      clinicId: params.clinicId,
      clientId: params.clientId,
    });

    const role = params.role;
    const allowAdminOnly = role === UserRole.admin || role === UserRole.CLINIC_ADMIN;

    const defaultWeekly = profile.key === "IOP" || profile.key === "PHP";
    let includeWeekly = params.includeWeeklyPacket ?? defaultWeekly;
    let weeklyOmittedReason: string | null = null;

    if (includeWeekly && !allowAdminOnly) {
      includeWeekly = false;
      weeklyOmittedReason = "Weekly packet omitted (requires clinic admin or admin role).";
    }

    const includeExternalLinks = params.includeExternalLinks ?? false;
    if (includeExternalLinks && !allowAdminOnly) {
      throw new ForbiddenException("External links require clinic admin or admin role");
    }

    const report = await this.aerReport.generateAerReport(
      params.clinicId,
      params.clientId,
      params.start,
      params.end,
      undefined,
      {
        periodStartLabel: params.startLabel,
        periodEndLabel: params.endLabel,
        generatedAtOverride: params.end,
      },
    );

    const { buffer: pdfBuffer } = await this.aerPdf.generatePdfReport(
      params.clinicId,
      params.clientId,
      params.start,
      params.end,
      undefined,
      {
        periodStartLabel: params.startLabel,
        periodEndLabel: params.endLabel,
        generatedAtOverride: params.end,
      },
    );

    const jsonString = JSON.stringify(report);
    const jsonBuffer = Buffer.from(jsonString, "utf8");
    const jsonHash = this.sha256(jsonBuffer);
    const pdfHash = this.sha256(pdfBuffer);
    const verification = JSON.stringify(report.meta.verification ?? null);

    const verificationText = [
      `REPORT_ID=${report.audit_integrity?.report_id ?? ""}`,
      `GENERATED_AT=${report.meta.generated_at}`,
      `META_VERIFICATION=${verification}`,
      `JSON_SHA256=${jsonHash}`,
      `PDF_SHA256=${pdfHash}`,
      "NOTE=Hashes validate integrity and determinism for this period.",
    ].join("\n");

    let weeklyPacketJson: Buffer | null = null;
    if (includeWeekly) {
      const weekly = await this.weeklyPacket.generatePacket({
        userId: params.userId,
        role: params.role,
        clinicId: params.clinicId,
        startLabel: params.startLabel,
        endLabel: params.endLabel,
        start: params.start,
        end: params.end,
        program: null,
        top: 10,
        includeExternalLinks: false,
        externalTtlMinutes: DEFAULT_EXTERNAL_TTL_MINUTES,
        nowOverride: params.end,
        generatedAtOverride: params.end,
      });
      weeklyPacketJson = Buffer.from(JSON.stringify(weekly), "utf8");
    }

    let escalationRows: Array<Record<string, any>> = [];
    let includeEscalations = false;
    let escalationsOmittedReason: string | null = null;
    if (allowAdminOnly) {
      const startParts = this.parsePeriodLabel(params.startLabel);
      const endParts = this.parsePeriodLabel(params.endLabel);
      const startDate = buildStorageDateFromParts(startParts);
      const endDate = buildStorageDateFromParts(endParts);

      const rows = await this.prisma.supervisor_escalations.findMany({
        where: {
          clinic_id: params.clinicId,
          period_start: { lte: endDate },
          period_end: { gte: startDate },
        },
      });

      includeEscalations = params.includeEscalations ?? rows.length > 0;

      if (includeEscalations) {
        escalationRows = rows.map((row) => ({
          escalation_id: row.id,
          client_id: row.client_id,
          period_start: row.period_start.toISOString().slice(0, 10),
          period_end: row.period_end.toISOString().slice(0, 10),
          reason: row.reason,
          status: row.status,
          note: row.note ?? null,
          created_at: row.created_at.toISOString(),
          resolved_at: row.resolved_at ? row.resolved_at.toISOString() : null,
        }));

        escalationRows.sort((a, b) => {
          if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
          if (a.period_start !== b.period_start) return a.period_start.localeCompare(b.period_start);
          if (a.client_id !== b.client_id) return a.client_id.localeCompare(b.client_id);
          return a.escalation_id.localeCompare(b.escalation_id);
        });
      }
    } else if (params.includeEscalations) {
      escalationsOmittedReason = "Escalations omitted (requires clinic admin or admin role).";
    }

    const externalLinks: string[] = [];
    if (includeExternalLinks) {
      const ttl = Math.max(params.externalTtlMinutes ?? DEFAULT_EXTERNAL_TTL_MINUTES, 1);
      const jsonToken = await this.externalAccess.createAerToken({
        userId: params.userId,
        role: params.role,
        clinicId: params.clinicId,
        clientId: params.clientId,
        start: params.startLabel,
        end: params.endLabel,
        program: null,
        format: "json",
        ttlMinutes: ttl,
      });
      const pdfToken = await this.externalAccess.createAerToken({
        userId: params.userId,
        role: params.role,
        clinicId: params.clinicId,
        clientId: params.clientId,
        start: params.startLabel,
        end: params.endLabel,
        program: null,
        format: "pdf",
        ttlMinutes: ttl,
      });
      externalLinks.push(`AER_JSON=${jsonToken.url}`);
      externalLinks.push(`AER_PDF=${pdfToken.url}`);
    }

    const acceptanceLanguage = profile.acceptance_language.trim();
    const forbiddenLanguage = this.formatLanguageBlock(FORBIDDEN_LANGUAGE);

    const fileList = [
      "AER.json",
      "AER.pdf",
      "verification.txt",
      "submission_summary.txt",
      "acceptance_language.md",
      "FORBIDDEN_LANGUAGE.md",
    ];

    if (weeklyPacketJson) fileList.push("weekly_packet.json");
    if (includeEscalations) fileList.push("escalations.json");
    if (externalLinks.length > 0) fileList.push("external_links.txt");

    const summaryLines = [
      `SUBMISSION_PROFILE=${profile.key}`,
      `PROFILE_DISPLAY_NAME=${profile.display_name}`,
      `PERIOD=${params.startLabel} to ${params.endLabel}`,
      `RECOMMENDED_PERIOD_DAYS=${profile.recommended_period_days}`,
      "INCLUDED_FILES:",
      ...fileList.sort().map((file) => `- ${file}`),
      "DISCLAIMERS:",
      `- ${profile.disclaimer_block}`,
    ];
    if (weeklyOmittedReason) summaryLines.push(`- ${weeklyOmittedReason}`);
    if (escalationsOmittedReason) summaryLines.push(`- ${escalationsOmittedReason}`);
    if (externalLinks.length > 0) {
      summaryLines.push(
        "- External links are time-bound and not part of deterministic hash verification.",
      );
    }

    const files: Array<{ name: string; data: Buffer }> = [
      { name: "AER.json", data: jsonBuffer },
      { name: "AER.pdf", data: pdfBuffer },
      { name: "verification.txt", data: Buffer.from(verificationText, "utf8") },
      { name: "submission_summary.txt", data: Buffer.from(summaryLines.join("\n"), "utf8") },
      { name: "acceptance_language.md", data: Buffer.from(acceptanceLanguage, "utf8") },
      { name: "FORBIDDEN_LANGUAGE.md", data: Buffer.from(forbiddenLanguage, "utf8") },
    ];

    if (weeklyPacketJson) {
      files.push({ name: "weekly_packet.json", data: weeklyPacketJson });
    }

    if (includeEscalations) {
      files.push({ name: "escalations.json", data: Buffer.from(JSON.stringify(escalationRows), "utf8") });
    }

    if (externalLinks.length > 0) {
      files.push({ name: "external_links.txt", data: Buffer.from(externalLinks.join("\n"), "utf8") });
    }

    const zip = this.createZip(files, new Date(report.meta.generated_at));

    return {
      buffer: zip,
      fileList,
    };
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();
