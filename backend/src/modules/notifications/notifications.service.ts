import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AesGcm } from "../../common/crypto/aes-gcm";
import { EmailService } from "../email/email.service";
import { Prisma } from "@prisma/client";

export type NotificationPayload = {
  kind:
    | "assignment_published"
    | "assignment_due_24h"
    | "assignment_manual_reminder"
    | "assignment_nudge_first";
  title: string;
  body: string;
  url?: string;
  assignmentId?: string;
  dueDate?: string | null;
};

export type NotificationDto = {
  id: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  data: NotificationPayload | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly aes: AesGcm;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    this.aes = AesGcm.fromEnv();
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationDto[]> {
    const rows = await this.prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
    });

    return rows.map((row) => {
      let data: NotificationPayload | null = null;
      if (row.data_cipher && row.data_nonce && row.data_tag) {
        try {
          const raw = this.aes.decrypt(row.data_cipher, row.data_nonce, row.data_tag);
          data = JSON.parse(raw) as NotificationPayload;
        } catch {
          data = null;
        }
      }

      return {
        id: row.id,
        type: row.type,
        readAt: row.read_at ? row.read_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
        data,
      };
    });
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const row = await this.prisma.notifications.findFirst({
      where: { id: notificationId, user_id: userId },
    });
    if (!row) {
      throw new NotFoundException("Notification not found");
    }

    const updated = await this.prisma.notifications.update({
      where: { id: notificationId },
      data: { read_at: new Date() },
    });

    let data: NotificationPayload | null = null;
    if (updated.data_cipher && updated.data_nonce && updated.data_tag) {
      try {
        const raw = this.aes.decrypt(
          updated.data_cipher,
          updated.data_nonce,
          updated.data_tag,
        );
        data = JSON.parse(raw) as NotificationPayload;
      } catch {
        data = null;
      }
    }

    return {
      id: updated.id,
      type: updated.type,
      readAt: updated.read_at ? updated.read_at.toISOString() : null,
      createdAt: updated.created_at.toISOString(),
      data,
    };
  }

  async notifyUser(params: {
    userId: string;
    type: string;
    payload: NotificationPayload;
    dedupeKey?: string | null;
    emailTo?: string | null;
    emailSubject?: string;
    emailText?: string;
    emailHtml?: string;
  }): Promise<{ created: boolean }> {
    const payloadJson = JSON.stringify(params.payload);
    const enc = this.aes.encrypt(payloadJson);

    try {
      await this.prisma.notifications.create({
        data: {
          user_id: params.userId,
          type: params.type,
          dedupe_key: params.dedupeKey ?? null,
          data_cipher: enc.cipher,
          data_nonce: enc.nonce,
          data_tag: enc.tag,
        },
      });
    } catch (err) {
      const known = err as Prisma.PrismaClientKnownRequestError;
      if (known?.code === "P2002") {
        return { created: false };
      }
      throw err;
    }

    if (params.emailTo && params.emailSubject && params.emailText && params.emailHtml) {
      await this.email.sendTransactional({
        to: params.emailTo,
        subject: params.emailSubject,
        text: params.emailText,
        html: params.emailHtml,
      });
    }

    return { created: true };
  }
}
