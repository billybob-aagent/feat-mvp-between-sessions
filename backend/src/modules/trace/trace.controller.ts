import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { TraceService } from "./trace.service";
import { buildDateRangeFromParts, dateOnlyPartsFromLocal, formatDateOnly, parseDateOnly } from "../../reports/aer/aer-report.utils";

function parseDateOnlyOrThrow(value: string) {
  const trimmed = value.trim();
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
  }
  return { parts, label: trimmed };
}

@Controller("trace")
export class TraceController {
  constructor(private trace: TraceService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("client/:clientId")
  async getClientTrace(
    @Req() req: any,
    @Param("clientId") clientId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("status") status?: string,
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

    const normalizedStatus = status?.trim().toUpperCase();
    const statusFilter =
      normalizedStatus === "NEEDS_REVIEW" || normalizedStatus === "REVIEWED"
        ? (normalizedStatus as "NEEDS_REVIEW" | "REVIEWED")
        : "ALL";

    return this.trace.getClientTrace({
      userId: req.user.userId,
      role: req.user.role,
      clientId,
      start: startLabel,
      end: endLabel,
      status: statusFilter,
    });
  }
}
