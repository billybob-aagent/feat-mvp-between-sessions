import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { SupervisorWeeklyPacketService } from "./supervisor-weekly-packet.service";
import { JwtAuthGuard } from "../../modules/auth/jwt-auth.guard";
import { RolesGuard } from "../../modules/auth/roles.guard";
import { Roles } from "../../modules/auth/roles.decorator";
import { UserRole } from "@prisma/client";
import {
  buildDateRangeFromParts,
  dateOnlyPartsFromLocal,
  formatDateOnly,
  parseDateOnly,
} from "../aer/aer-report.utils";

function parseDateOnlyOrThrow(value: string) {
  const trimmed = value.trim();
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
  }
  return { parts, label: trimmed };
}

@Controller("reports/supervisor-weekly-packet")
export class SupervisorWeeklyPacketController {
  constructor(private service: SupervisorWeeklyPacketService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get(":clinicId")
  async generate(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("program") program?: string,
    @Query("top") topRaw?: string,
    @Query("includeExternalLinks") includeExternalLinks?: string,
    @Query("externalTtlMinutes") externalTtlMinutes?: string,
  ) {
    const endInput = end?.trim();
    const endParsed = endInput ? parseDateOnlyOrThrow(endInput) : null;
    const endParts = endParsed?.parts ?? dateOnlyPartsFromLocal(new Date());
    const endLabel = endParsed?.label ?? formatDateOnly(endParts);
    const endRange = buildDateRangeFromParts(endParts);

    const defaultStartDate = new Date(endRange.end);
    defaultStartDate.setDate(defaultStartDate.getDate() - 6);
    const defaultStartParts = dateOnlyPartsFromLocal(defaultStartDate);

    const startInput = start?.trim();
    const startParsed = startInput ? parseDateOnlyOrThrow(startInput) : null;
    const startParts = startParsed?.parts ?? defaultStartParts;
    const startLabel = startParsed?.label ?? formatDateOnly(startParts);
    const startRange = buildDateRangeFromParts(startParts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("Start date must be before end date");
    }

    const includeExternal = includeExternalLinks === "true";
    const top = this.service.parseTop(topRaw, 10);
    const ttl = this.service.parseExternalTtl(externalTtlMinutes, 60);

    return this.service.generatePacket({
      userId: req.user.userId,
      role: req.user.role,
      clinicId,
      startLabel,
      endLabel,
      start: startRange.start,
      end: endRange.end,
      program: program?.trim() || null,
      top,
      includeExternalLinks: includeExternal,
      externalTtlMinutes: ttl,
    });
  }
}
