import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { JwtRolesGuard, Roles } from '../auth/roles.guard';

@Controller('prompts')
export class PromptsController {
  constructor(private prompts: PromptsService) {}

  @UseGuards(JwtRolesGuard)
  @Roles('therapist')
  @Post('create')
  async create(@Body() dto: { title: string; content: string }, @Req() req: any) {
    return this.prompts.create(req.user.sub, dto.title, dto.content);
  }

  @UseGuards(JwtRolesGuard)
  @Roles('therapist')
  @Get()
  async list(@Req() req: any) {
    return this.prompts.list(req.user.sub);
  }
}