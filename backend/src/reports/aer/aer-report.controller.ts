import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AerReportService } from "./aer-report.service";
import { JwtAuthGuard } from "../../modules/auth/jwt-auth.guard";
import { RolesGuard } from "../../modules/auth/roles.guard";
import { Roles } from "../../modules/auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { AuditService } from "../../modules/audit/audit.service";
import {
  buildDateRangeFromParts,
  dateOnlyPartsFromLocal,
  formatDateOnly,
  parseDateOnly,
} from "./aer-report.utils";

function parseDateOnlyOrThrow(value: string) {
  const trimmed = value.trim();
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
  }
  return { parts, label: trimmed };
}

@Controller("reports/aer")
export class AerReportController {
  constructor(
    private aerReport: AerReportService,
    private audit: AuditService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get(":clinicId/:clientId")
  async generate(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Param("clientId") clientId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("program") program?: string,
  ) {
    const endInput = end?.trim();
    const endParsed = endInput ? parseDateOnlyOrThrow(endInput) : null;
    const endParts = endParsed?.parts ?? dateOnlyPartsFromLocal(new Date());
    const endLabel = endParsed?.label ?? formatDateOnly(endParts);
    const endRange = buildDateRangeFromParts(endParts);

    const defaultStartDate = new Date(endRange.end);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    const defaultStartParts = dateOnlyPartsFromLocal(defaultStartDate);

    const startInput = start?.trim();
    const startParsed = startInput ? parseDateOnlyOrThrow(startInput) : null;
    const startParts = startParsed?.parts ?? defaultStartParts;
    const startLabel = startParsed?.label ?? formatDateOnly(startParts);
    const startRange = buildDateRangeFromParts(startParts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("Start date must be before end date");
    }

    await this.aerReport.ensureClinicAccess(req.user.userId, req.user.role, clinicId);

    const report = await this.aerReport.generateAerReport(
      clinicId,
      clientId,
      startRange.start,
      endRange.end,
      program?.trim() || undefined,
      {
        periodStartLabel: startLabel,
        periodEndLabel: endLabel,
        // Deterministic generated_at for JSON to match PDF behavior.
        generatedAtOverride: endRange.end,
      },
    );

    try {
      await this.audit.log({
        userId: req.user.userId,
        action: "aer.generate",
        entityType: "clinic",
        entityId: clinicId,
        ip: req.ip,
        userAgent: req.headers?.["user-agent"],
        metadata: {
          clinicId,
          clientId,
          format: "json",
          periodStart: startLabel,
          periodEnd: endLabel,
          program: program?.trim() || null,
        },
      });
    } catch (err) {
      // Side-effect only: audit logging must never block report delivery.
      console.warn("AER audit log failed (json).", err instanceof Error ? err.message : err);
    }

    return report;
  }
}
