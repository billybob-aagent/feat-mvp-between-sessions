import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('checkins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.client)
export class CheckinsController {
  constructor(private checkins: CheckinsService) {}

  @Post('submit')
  async submit(@Body() dto: { mood: number; note?: string }, @Req() req: any) {
    return this.checkins.submit(req.user.userId, dto);
  }
}
