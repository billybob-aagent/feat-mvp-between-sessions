import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PilotMetricsController } from "./pilot-metrics.controller";
import { PilotMetricsService } from "./pilot-metrics.service";
import { ReviewMetricsController } from "./review-metrics.controller";
import { ReviewRevenueMetricsService } from "./review-metrics.service";

@Module({
  imports: [PrismaModule],
  controllers: [PilotMetricsController, ReviewMetricsController],
  providers: [PilotMetricsService, ReviewRevenueMetricsService],
})
export class MetricsModule {}
