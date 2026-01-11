import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ClientResponseListItemDto,
  ResponsesService,
  SubmitResponseResultDto,
  TherapistDecryptedResponseDto,
  TherapistFlagResultDto,
  TherapistResponseListDto,
  TherapistReviewResultDto,
  TherapistStarResultDto,
} from "./responses.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { SubmitResponseDto } from "./dto/submit-response.dto";

type ReviewedFilter = "all" | "reviewed" | "unreviewed";
type FlaggedFilter = "all" | "flagged" | "unflagged";

@Controller("responses")
export class ResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  // Client submits a response (encrypted)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @Post("submit")
  async submit(
    @Req() req: any,
    @Body() dto: SubmitResponseDto,
  ): Promise<SubmitResponseResultDto> {
    return this.responses.submit(req.user.userId, dto);
  }

  // Client: list my responses for an assignment
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @Get("client/assignment/:assignmentId")
  async listForClientAssignment(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
  ): Promise<ClientResponseListItemDto[]> {
    return this.responses.listForClientAssignment(req.user.userId, assignmentId);
  }

  // Therapist: list responses for an assignment (NO decrypt)
  // Filters + cursor pagination
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get("therapist/assignment/:assignmentId")
  async listForAssignment(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
    @Query("q") q?: string,
    @Query("clientId") clientId?: string,
    @Query("reviewed") reviewed: ReviewedFilter = "all",
    @Query("flagged") flagged: FlaggedFilter = "all",
    @Query("limit") limitRaw?: string,
    @Query("take") takeRaw?: string,
    @Query("cursor") cursor?: string,
  ): Promise<TherapistResponseListDto> {
    const raw = limitRaw ?? takeRaw;
    const take = Math.min(Math.max(parseInt(raw || "20", 10) || 20, 1), 100);

    return this.responses.listForTherapistAssignment(req.user.userId, assignmentId, {
      q: q?.trim() || null,
      clientId: clientId?.trim() || null,
      reviewed,
      flagged,
      take,
      cursor: cursor || null,
    });
  }

  // Therapist: decrypt and return a single response (text included)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get("therapist/:responseId")
  async decryptOne(
    @Req() req: any,
    @Param("responseId") responseId: string,
  ): Promise<TherapistDecryptedResponseDto> {
    return this.responses.decryptForTherapist(req.user.userId, responseId);
  }

  // Therapist: mark reviewed + optional internal note (encrypted)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Patch("therapist/:responseId/review")
  async markReviewed(
    @Req() req: any,
    @Param("responseId") responseId: string,
    @Body() body: { therapistNote?: string },
  ): Promise<TherapistReviewResultDto> {
    return this.responses.markReviewed(req.user.userId, responseId, body?.therapistNote);
  }

  // Therapist: update note without marking reviewed
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Patch("therapist/:responseId/note")
  async updateNote(
    @Req() req: any,
    @Param("responseId") responseId: string,
    @Body() body: { therapistNote?: string },
  ): Promise<{ id: string; hasNote: boolean }> {
    return this.responses.updateTherapistNote(req.user.userId, responseId, body?.therapistNote);
  }

  // Therapist: toggle flagged (flag/unflag)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Patch("therapist/:responseId/flag")
  async toggleFlag(
    @Req() req: any,
    @Param("responseId") responseId: string,
  ): Promise<TherapistFlagResultDto> {
    return this.responses.toggleFlag(req.user.userId, responseId);
  }

  // Therapist: toggle star (star/unstar)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Patch("therapist/:responseId/star")
  async toggleStar(
    @Req() req: any,
    @Param("responseId") responseId: string,
  ): Promise<TherapistStarResultDto> {
    return this.responses.toggleStar(req.user.userId, responseId);
  }
}
