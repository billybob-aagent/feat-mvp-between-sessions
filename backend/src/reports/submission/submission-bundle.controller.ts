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
import { JwtAuthGuard } from "../../modules/auth/jwt-auth.guard";
import { RolesGuard } from "../../modules/auth/roles.guard";
import { Roles } from "../../modules/auth/roles.decorator";
import { UserRole } from "@prisma/client";
import {
  buildDateRangeFromParts,
  formatDateOnly,
  parseDateOnly,
} from "../aer/aer-report.utils";
import { getSubmissionProfile, SubmissionProfileKey } from "./profiles";
import { SubmissionBundleService } from "./submission-bundle.service";

type SubmissionBundleRequest = {
  clinicId: string;
  clientId: string;
  start: string;
  end: string;
  profile?: SubmissionProfileKey;
  includeWeeklyPacket?: boolean;
  includeEscalations?: boolean;
  includeExternalLinks?: boolean;
  externalTtlMinutes?: number;
};

function parseDateOnlyOrThrow(value: string) {
  const trimmed = value.trim();
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new BadRequestException("Invalid date format (expected YYYY-MM-DD)");
  }
  return { parts, label: trimmed };
}

@Controller("reports/submission-bundle")
export class SubmissionBundleController {
  constructor(private service: SubmissionBundleService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.CLINIC_ADMIN, UserRole.admin)
  @Post()
  async generateBundle(
    @Req() req: any,
    @Body() body: SubmissionBundleRequest,
    @Res() res: Response,
  ) {
    if (!body?.clinicId || !body?.clientId || !body?.start || !body?.end) {
      throw new BadRequestException("clinicId, clientId, start, and end are required");
    }

    const startParsed = parseDateOnlyOrThrow(body.start);
    const endParsed = parseDateOnlyOrThrow(body.end);
    const startLabel = startParsed.label ?? formatDateOnly(startParsed.parts);
    const endLabel = endParsed.label ?? formatDateOnly(endParsed.parts);

    const startRange = buildDateRangeFromParts(startParsed.parts);
    const endRange = buildDateRangeFromParts(endParsed.parts);

    if (startRange.start > endRange.end) {
      throw new BadRequestException("Start date must be before end date");
    }

    const profile = getSubmissionProfile(body.profile).key;

    const result = await this.service.generateBundle({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: body.clinicId,
      clientId: body.clientId,
      startLabel,
      endLabel,
      start: startRange.start,
      end: endRange.end,
      profile,
      includeWeeklyPacket: body.includeWeeklyPacket,
      includeEscalations: body.includeEscalations,
      includeExternalLinks: body.includeExternalLinks,
      externalTtlMinutes: body.externalTtlMinutes,
    });

    const filename = `SUBMISSION_BUNDLE_${body.clinicId}_${body.clientId}_${startLabel}_${endLabel}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

    return res.status(200).send(result.buffer);
  }
}
