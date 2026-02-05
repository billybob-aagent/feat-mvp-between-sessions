import { Module } from "@nestjs/common";
import { AiSafetyGatewayController } from "./ai-safety-gateway.controller";
import { AiSafetyGatewayService } from "./ai-safety-gateway.service";
import { RedactionService } from "./redaction/redaction.service";
import { PolicyService } from "./policy/policy.service";
import { PrismaModule } from "../modules/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AiSafetyGatewayController],
  providers: [AiSafetyGatewayService, RedactionService, PolicyService],
  exports: [AiSafetyGatewayService],
})
export class AiSafetyGatewayModule {}
