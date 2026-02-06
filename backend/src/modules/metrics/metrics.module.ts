import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PilotMetricsController } from "./pilot-metrics.controller";
import { PilotMetricsService } from "./pilot-metrics.service";

@Module({
  imports: [PrismaModule],
  controllers: [PilotMetricsController],
  providers: [PilotMetricsService],
})
export class MetricsModule {}
