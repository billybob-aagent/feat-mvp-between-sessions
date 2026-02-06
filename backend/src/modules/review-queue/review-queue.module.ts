import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ResponsesModule } from "../responses/responses.module";
import { ReviewQueueController } from "./review-queue.controller";
import { ReviewQueueService } from "./review-queue.service";

@Module({
  imports: [PrismaModule, ResponsesModule],
  controllers: [ReviewQueueController],
  providers: [ReviewQueueService],
})
export class ReviewQueueModule {}
