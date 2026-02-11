import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditModule } from "../audit/audit.module";
import { SupervisorActionsModule } from "../../supervisor-actions/supervisor-actions.module";
import { EngagementService } from "./engagement.service";

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule, SupervisorActionsModule],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
