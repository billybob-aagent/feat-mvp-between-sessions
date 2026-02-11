import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { ReviewRevenueMetricsService } from "./review-metrics.service";
import { MetricsBucket } from "./review-metrics.utils";

@Controller("metrics")
export class ReviewMetricsController {
  constructor(private metrics: ReviewRevenueMetricsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("clinic/:clinicId")
  async clinicMetrics(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
  ) {
    return this.metrics.getClinicMetrics({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: clinicId.trim(),
      start: start ?? "",
      end: end ?? "",
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get("therapist/:clinicId")
  async therapistMetrics(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
  ) {
    return this.metrics.getTherapistMetrics({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: clinicId.trim(),
      start: start ?? "",
      end: end ?? "",
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLINIC_ADMIN, UserRole.admin)
  @Get("clinic/:clinicId/series")
  async clinicSeries(
    @Req() req: any,
    @Param("clinicId") clinicId: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("bucket") bucket?: string,
  ) {
    const normalizedBucket = (bucket ?? "day").toLowerCase();
    if (normalizedBucket !== "day" && normalizedBucket !== "week") {
      throw new BadRequestException("bucket must be day or week");
    }

    return this.metrics.getClinicSeries({
      userId: req.user.userId,
      role: req.user.role,
      clinicId: clinicId.trim(),
      start: start ?? "",
      end: end ?? "",
      bucket: normalizedBucket as MetricsBucket,
    });
  }
}
