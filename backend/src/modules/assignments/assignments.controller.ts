import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  AssignmentsService,
  ClientAssignmentDetailDto,
  ClientAssignmentListItemDto,
  TherapistAssignmentDetailDto,
  TherapistAssignmentListItemDto,
} from "./assignments.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { UpdateAssignmentDto } from "./dto/update-assignment.dto";
import { PublishAssignmentDto } from "./dto/publish-assignment.dto";

@Controller("assignments")
export class AssignmentsController {
  constructor(private assignments: AssignmentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Post("create")
  async create(
    @Body()
    dto: { clientId: string; promptId: string; dueDate?: string; recurrence?: string },
    @Req() req: any,
  ) {
    return this.assignments.create(req.user.userId, dto);
  }

  // Therapist: create assignment draft
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Post()
  async createDraft(
    @Body() dto: CreateAssignmentDto,
    @Req() req: any,
  ): Promise<TherapistAssignmentDetailDto> {
    return this.assignments.createDraft(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @Get("mine")
  async mine(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ items: ClientAssignmentListItemDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(parseInt(limitRaw || "20", 10) || 20, 1), 100);
    return this.assignments.listForClient(req.user.userId, {
      q: q?.trim() || null,
      limit,
      cursor: cursor || null,
    });
  }

  // Client: assignment detail (published only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @Get("mine/:assignmentId")
  async clientDetail(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
  ): Promise<ClientAssignmentDetailDto> {
    return this.assignments.getClientAssignmentDetail(req.user.userId, assignmentId);
  }

  // ✅ therapist dashboard uses this
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get("therapist/mine")
  async mineForTherapist(@Req() req: any): Promise<TherapistAssignmentListItemDto[]> {
    const data = await this.assignments.listForTherapist(req.user.userId, {
      q: null,
      status: null,
      limit: 50,
      cursor: null,
    });
    return data.items;
  }

  // ✅ canonical endpoint for therapist assignment list
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get("therapist")
  async listForTherapist(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ items: TherapistAssignmentListItemDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(parseInt(limitRaw || "20", 10) || 20, 1), 100);
    const normalizedStatus =
      status === "draft" || status === "published" ? status : null;
    return this.assignments.listForTherapist(req.user.userId, {
      q: q?.trim() || null,
      status: normalizedStatus,
      limit,
      cursor: cursor || null,
    });
  }

  // Therapist: assignment detail
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get("therapist/:assignmentId")
  async therapistDetail(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
  ): Promise<TherapistAssignmentDetailDto> {
    return this.assignments.getForTherapist(req.user.userId, assignmentId);
  }

  // Therapist: update assignment fields
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Patch("therapist/:assignmentId")
  async updateAssignment(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ): Promise<TherapistAssignmentDetailDto> {
    return this.assignments.updateAssignment(req.user.userId, assignmentId, dto);
  }

  // Therapist: publish/unpublish assignment
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Patch("therapist/:assignmentId/publish")
  async publishAssignment(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: PublishAssignmentDto,
  ): Promise<TherapistAssignmentDetailDto> {
    return this.assignments.setPublished(req.user.userId, assignmentId, dto.published);
  }

  // Therapist: send manual reminder to client
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Post("therapist/:assignmentId/remind")
  async remindClient(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
  ): Promise<{ ok: true }> {
    return this.assignments.sendManualReminder(req.user.userId, assignmentId);
  }
}
