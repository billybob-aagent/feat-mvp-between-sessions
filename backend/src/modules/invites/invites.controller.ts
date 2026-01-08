import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('invites')
export class InvitesController {
  constructor(private invites: InvitesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Post('create')
  async create(@Body('email') email: string, @Req() req: any) {
    const invite = await this.invites.createInvite(req.user.userId, email);
    return { token: invite.token, expires_at: invite.expires_at };
  }

  // Public for client onboarding
  @Get('lookup')
  async lookup(@Query('token') token: string) {
    const inv = await this.invites.getInvite(token);
    const isExpired = inv.expires_at.getTime() < Date.now();

    return {
      email: inv.email,
      status: inv.status,
      expires_at: inv.expires_at,
      isExpired,
    };
  }
}
