import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { EmailModule } from "../email/email.module";
import { RemindersService } from "./reminders.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, EmailModule, AuditModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, RemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
