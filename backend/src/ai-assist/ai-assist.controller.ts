import { BadRequestException, Body, Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AiAssistService } from "./ai-assist.service";
import { JwtAuthGuard } from "../modules/auth/jwt-auth.guard";
import { RolesGuard } from "../modules/auth/roles.guard";
import { Roles } from "../modules/auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { AdherenceAssistDto } from "./dto/adherence-assist.dto";
import { AdherenceFeedbackDraftDto } from "./dto/adherence-feedback.dto";
import { AssessmentAssistDto } from "./dto/assessment-assist.dto";
import { ProgressSummaryDraftDto } from "./dto/progress-summary.dto";
import { SupervisorSummaryDraftDto } from "./dto/supervisor-summary.dto";
import { buildDateRangeFromParts, parseDateOnly } from "../reports/aer/aer-report.utils";

const parseDateOnlyOrThrow = (value: string, label: string) => {
  const trimmed = value.trim();
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new BadRequestException(`Invalid ${label} date format (expected YYYY-MM-DD)`);
  }
  return parts;
};

const validatePeriod = (start: string, end: string) => {
  const startParts = parseDateOnlyOrThrow(start, "periodStart");
  const endParts = parseDateOnlyOrThrow(end, "periodEnd");
  const startRange = buildDateRangeFromParts(startParts);
  const endRange = buildDateRangeFromParts(endParts);
  if (startRange.start > endRange.end) {
    throw new BadRequestException("periodStart must be before periodEnd");
  }
};

@Controller("ai")
export class AiAssistController {
  constructor(private assist: AiAssistService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN, UserRole.therapist)
  @Post("adherence-assist")
  async adherenceAssist(
    @Req() req: any,
    @Body() dto: AdherenceAssistDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    validatePeriod(dto.periodStart, dto.periodEnd);

    const result = await this.assist.adherenceAssist({
      userId: req.user.userId,
      role: req.user.role,
      payload: {
        clinicId: dto.clinicId,
        clientId: dto.clientId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        completion_criteria: dto.completion_criteria,
        client_response: dto.client_response,
        context: dto.context ?? null,
      },
    });

    if (result.ok === false) {
      res.status(403);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN, UserRole.therapist)
  @Post("assessment-assist")
  async assessmentAssist(
    @Req() req: any,
    @Body() dto: AssessmentAssistDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.assist.assessmentAssist({
      userId: req.user.userId,
      role: req.user.role,
      payload: {
        clinicId: dto.clinicId,
        clientId: dto.clientId,
        assessment_type: dto.assessment_type,
        inputs: dto.inputs,
        note: dto.note ?? null,
      },
    });

    if (result.ok === false) {
      res.status(403);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN, UserRole.therapist)
  @Post("progress-summary/preview")
  async progressSummaryPreview(@Req() req: any, @Body() dto: ProgressSummaryDraftDto) {
    validatePeriod(dto.periodStart, dto.periodEnd);

    return this.assist.progressSummaryPreview({
      userId: req.user.userId,
      role: req.user.role,
      payload: {
        clinicId: dto.clinicId,
        clientId: dto.clientId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
      },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("supervisor-summary/preview")
  async supervisorSummaryPreview(@Req() req: any, @Body() dto: SupervisorSummaryDraftDto) {
    validatePeriod(dto.periodStart, dto.periodEnd);

    return this.assist.supervisorSummaryPreview({
      userId: req.user.userId,
      role: req.user.role,
      payload: {
        clinicId: dto.clinicId,
        clientId: dto.clientId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
      },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN, UserRole.therapist)
  @Post("progress-summary")
  async progressSummaryDraft(
    @Req() req: any,
    @Body() dto: ProgressSummaryDraftDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    validatePeriod(dto.periodStart, dto.periodEnd);

    const result = await this.assist.progressSummaryDraft({
      userId: req.user.userId,
      role: req.user.role,
      payload: {
        clinicId: dto.clinicId,
        clientId: dto.clientId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
      },
    });

    if (result.ok === false) {
      res.status(403);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("supervisor-summary")
  async supervisorSummaryDraft(
    @Req() req: any,
    @Body() dto: SupervisorSummaryDraftDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    validatePeriod(dto.periodStart, dto.periodEnd);

    const result = await this.assist.supervisorSummaryDraft({
      userId: req.user.userId,
      role: req.user.role,
      payload: {
        clinicId: dto.clinicId,
        clientId: dto.clientId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
      },
    });

    if (result.ok === false) {
      res.status(403);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.CLINIC_ADMIN, UserRole.therapist)
  @Post("adherence-feedback")
  async adherenceFeedbackDraft(
    @Req() req: any,
    @Body() dto: AdherenceFeedbackDraftDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.assist.adherenceFeedbackDraft({
      userId: req.user.userId,
      role: req.user.role,
      payload: {
        clinicId: dto.clinicId,
        responseId: dto.responseId,
      },
    });

    if (result.ok === false) {
      res.status(403);
    }

    return result;
  }
}
