import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('feedback')
export class FeedbackController {
  constructor(private feedback: FeedbackService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Post('create')
  async create(@Body() dto: { responseId: string; text: string }, @Req() req: any) {
    // your JwtAuthGuard puts user info on req.user; your invites controller uses req.user.userId
    return this.feedback.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get('by-response/:id')
  async list(@Param('id') id: string, @Req() req: any) {
    return this.feedback.listForResponse(req.user.userId, id);
  }
}
