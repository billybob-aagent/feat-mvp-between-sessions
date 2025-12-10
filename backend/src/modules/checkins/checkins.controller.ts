import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { JwtRolesGuard, Roles } from '../auth/roles.guard';

@Controller('checkins')
export class CheckinsController {
  constructor(private checkins: CheckinsService) {}

  @UseGuards(JwtRolesGuard)
  @Roles('client')
  @Post('submit')
  async submit(@Body() dto: { mood: number; note?: string }, @Req() req: any) {
    return this.checkins.submit(req.user.sub, dto);
  }
}
