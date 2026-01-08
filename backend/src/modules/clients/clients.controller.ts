import { Controller, Get, GoneException, Req, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('clients')
export class ClientsController {
  constructor(private clients: ClientsService) {}

  /**
   * Therapist-only: list my clients for assignment dropdowns, etc.
   * GET /api/v1/clients/mine
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get('mine')
  async mine(@Req() req: any) {
    return this.clients.listForTherapist(req.user.userId);
  }

  /**
   * Legacy endpoint: DO NOT USE.
   * The canonical onboarding path is now POST /api/v1/auth/register-client
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get('accept-invite-legacy')
  legacyNotice() {
    throw new GoneException(
      'Legacy invite acceptance removed. Use POST /api/v1/auth/register-client from the public accept-invite page.',
    );
  }
}
