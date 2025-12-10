import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtRolesGuard, Roles } from '../auth/roles.guard';

@Controller('feedback')
export class FeedbackController {
  constructor(private feedback: FeedbackService) {}

  @UseGuards(JwtRolesGuard)
  @Roles('therapist')
  @Post('create')
  async create(@Body() dto: { responseId: string; text: string }, @Req() req: any) {
    return this.feedback.create(req.user.sub, dto);
  }

  @UseGuards(JwtRolesGuard)
  @Roles('therapist')
  @Get('by-response/:id')
  async list(@Param('id') id: string, @Req() req: any) {
    return this.feedback.listForResponse(req.user.sub, id);
  }
}
