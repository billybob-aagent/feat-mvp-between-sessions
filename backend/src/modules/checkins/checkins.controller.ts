import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { CheckinsService } from "./checkins.service";

@Controller("checkins")
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @Post("submit")
  async submit(
    @Body() dto: { mood: number; note?: string | null },
    @Req() req: any,
  ) {
    // ✅ normalize null -> undefined, and trim
    const note =
      dto.note === null
        ? undefined
        : typeof dto.note === "string" && dto.note.trim().length > 0
          ? dto.note.trim()
          : undefined;

    return this.checkins.submit(req.user.userId, {
      mood: dto.mood,
      note,
    });
  }
}

