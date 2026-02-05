import { Module } from "@nestjs/common";
import { SupervisorActionsController } from "./supervisor-actions.controller";
import { SupervisorActionsService } from "./supervisor-actions.service";
import { PrismaModule } from "../modules/prisma/prisma.module";
import { AuditModule } from "../modules/audit/audit.module";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupervisorActionsController],
  providers: [SupervisorActionsService],
})
export class SupervisorActionsModule {}
