import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtRolesGuard, Roles } from '../auth/roles.guard';

@Controller('assignments')
export class AssignmentsController {
  constructor(private assignments: AssignmentsService) {}

  @UseGuards(JwtRolesGuard)
  @Roles('therapist')
  @Post('create')
  async create(
    @Body() dto: { clientId: string; promptId: string; dueDate?: string; recurrence?: string },
    @Req() req: any,
  ) {
    return this.assignments.create(req.user.sub, dto);
  }

  @UseGuards(JwtRolesGuard)
  @Roles('client')
  @Get('mine')
  async mine(@Req() req: any) {
    return this.assignments.listForClient(req.user.sub);
  }
}