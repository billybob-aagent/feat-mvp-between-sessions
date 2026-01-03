import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtRolesGuard, Roles } from '../auth/roles.guard';

@Controller('invites')
export class InvitesController {
  constructor(private invites: InvitesService) {}

  @UseGuards(JwtRolesGuard)
  @Roles('therapist')
  @Post('create')
  async create(@Body('email') email: string, @Req() req: any) {
    const invite = await this.invites.createInvite(req.user.sub, email);
    return { token: invite.token, expires_at: invite.expires_at };
  }

  @Get('lookup')
  async lookup(@Query('token') token: string) {
    const inv = await this.invites.getInvite(token);
    return { email: inv.email, status: inv.status };
  }
}