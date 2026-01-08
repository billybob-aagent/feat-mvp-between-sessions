import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('assignments')
export class AssignmentsController {
  constructor(private assignments: AssignmentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Post('create')
  async create(
    @Body()
    dto: { clientId: string; promptId: string; dueDate?: string; recurrence?: string },
    @Req() req: any,
  ) {
    return this.assignments.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @Get('mine')
  async mine(@Req() req: any) {
    return this.assignments.listForClient(req.user.userId);
  }
}
