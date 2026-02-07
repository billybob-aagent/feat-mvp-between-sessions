import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { AerBundleService } from "./aer-bundle.service";
import { AerReportService } from "../aer/aer-report.service";
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

type AerBundleRequest = {
  clinicId: string;
  clientId: string;
  start: string;
  end: string;
};

function parseDateOnlyOrThrow(value: string) {
  const trimmed = value.trim();
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
  }
  return { parts, label: trimmed };
}

@Controller("reports/aer-bundle")
export class AerBundleController {
  constructor(
    private bundles: AerBundleService,
    private aerReport: AerReportService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post()
  async generateBundle(
    @Req() req: any,
    @Body() body: AerBundleRequest,
    @Res() res: Response,
  ) {
    if (!body?.clinicId || !body?.clientId || !body?.start || !body?.end) {
      throw new BadRequestException("clinicId, clientId, start, and end are required");
    }

    const endParsed = parseDateOnlyOrThrow(body.end);
    const endParts = endParsed.parts ?? dateOnlyPartsFromLocal(new Date());
    const endLabel = endParsed.label ?? formatDateOnly(endParts);
    const endRange = buildDateRangeFromParts(endParts);

    const startParsed = parseDateOnlyOrThrow(body.start);
    const startParts = startParsed.parts;
    const startLabel = startParsed.label ?? formatDateOnly(startParts);
    const startRange = buildDateRangeFromParts(startParts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("Start date must be before end date");
    }

    await this.aerReport.ensureClinicAccess(req.user.userId, req.user.role, body.clinicId);

    const result = await this.bundles.generateBundle({
      clinicId: body.clinicId,
      clientId: body.clientId,
      start: startRange.start,
      end: endRange.end,
      periodStartLabel: startLabel,
      periodEndLabel: endLabel,
    });

    const filename = `AER_BUNDLE_${body.clinicId}_${body.clientId}_${startLabel}_${endLabel}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

    return res.status(200).send(result.buffer);
  }
}
