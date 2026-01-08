import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.therapist)
export class PromptsController {
  constructor(private prompts: PromptsService) {}

  @Post('create')
  async create(@Body() dto: { title: string; content: string }, @Req() req: any) {
    // req.user is set by CookieJwtStrategy.validate()
    return this.prompts.create(req.user.userId, dto.title, dto.content);
  }

  @Get()
  async list(@Req() req: any) {
    return this.prompts.list(req.user.userId);
  }
}
