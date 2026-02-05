import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async sendDueSoonReminders() {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const assignments = await this.prisma.assignments.findMany({
      where: {
        status: "published",
        due_date: {
          gt: now,
          lte: cutoff,
        },
      },
      select: {
        id: true,
        due_date: true,
        title: true,
        prompt: { select: { title: true } },
        therapist: { select: { user_id: true } },
        client: {
          select: {
            user_id: true,
            full_name: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    for (const assignment of assignments) {
      const userId = assignment.client?.user_id;
      const email = assignment.client?.user?.email ?? null;
      if (!userId) continue;

      const title = assignment.title ?? assignment.prompt?.title ?? "Assignment";
      const dueDate = assignment.due_date ? assignment.due_date.toISOString() : null;
      const url = `${baseUrl}/app/client/assignments/${assignment.id}`;

      const dedupeKey = `assignment:${assignment.id}:reminder:24h`;

      await this.notifications.notifyUser({
        userId,
        type: "assignment_due_24h",
        dedupeKey,
        payload: {
          kind: "assignment_due_24h",
          title: "Check-in due soon",
          body: `Your check-in "${title}" is due within 24 hours if you want to complete it.`,
          url,
          assignmentId: assignment.id,
          dueDate,
        },
        emailTo: email,
        emailSubject: "Check-in due soon",
        emailText: `Your check-in "${title}" is due within 24 hours if you want to complete it. Open: ${url}`,
        emailHtml: `<p>Your check-in <strong>${title}</strong> is due within 24 hours if you want to complete it.</p><p><a href="${url}">Open check-in</a></p>`,
      });

      await this.audit.log({
        userId: assignment.therapist?.user_id ?? userId,
        action: "assignment.reminder.24h",
        entityType: "assignment",
        entityId: assignment.id,
        metadata: { dueDate, clientId: userId },
      });
    }

    if (assignments.length > 0) {
      this.logger.log(`Processed ${assignments.length} due-soon reminders.`);
    }
  }
}
