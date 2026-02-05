import { Module } from "@nestjs/common";
import { AiAssistController } from "./ai-assist.controller";
import { AiAssistService } from "./ai-assist.service";
import { AiSafetyGatewayModule } from "../ai-safety-gateway/ai-safety-gateway.module";
import { PrismaModule } from "../modules/prisma/prisma.module";
import { RetrievalService } from "./retrieval/retrieval.service";

@Module({
  imports: [AiSafetyGatewayModule, PrismaModule],
  controllers: [AiAssistController],
  providers: [AiAssistService, RetrievalService],
})
export class AiAssistModule {}
