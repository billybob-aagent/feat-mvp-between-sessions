import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ReviewQueueService } from "./review-queue.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";

type ReviewedFilter = "all" | "reviewed" | "unreviewed";

type FlaggedFilter = "all" | "flagged" | "unflagged";

@Controller("review-queue")
export class ReviewQueueController {
  constructor(private readonly reviewQueue: ReviewQueueService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get()
  async list(
    @Req() req: any,
    @Query("clinicId") clinicId?: string,
    @Query("q") q?: string,
    @Query("reviewed") reviewed: ReviewedFilter = "all",
    @Query("flagged") flagged: FlaggedFilter = "all",
    @Query("limit") limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "25", 10) || 25, 1), 200);
    return this.reviewQueue.list({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: clinicId?.trim() || null,
      q: q?.trim() || null,
      reviewed,
      flagged,
      limit,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Post("mark-reviewed")
  async markReviewed(
    @Req() req: any,
    @Body() body: { responseIds?: string[]; therapistNote?: string },
  ) {
    return this.reviewQueue.markReviewed({
      userId: req.user.userId,
      role: req.user.role,
      responseIds: body.responseIds ?? [],
      therapistNote: body.therapistNote ?? undefined,
    });
  }
}
