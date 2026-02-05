import { Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { NotificationsService, NotificationDto } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() req: any,
    @Query("limit") limitRaw?: string,
  ): Promise<NotificationDto[]> {
    const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 100);
    return this.notifications.listForUser(req.user.userId, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":notificationId/read")
  async markRead(
    @Req() req: any,
    @Param("notificationId") notificationId: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(req.user.userId, notificationId);
  }
}
