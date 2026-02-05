import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService, AuditLogDto } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get('mine')
  async mine(
    @Req() req: any,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: AuditLogDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(parseInt(limitRaw || '50', 10) || 50, 1), 100);
    return this.audit.listForUser({
      userId: req.user.userId,
      limit,
      cursor: cursor || null,
    });
  }
}
