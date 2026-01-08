import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { InviteStatus } from '@prisma/client';

@Injectable()
export class InvitesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async createInvite(therapistUserId: string, email: string) {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
    });
    if (!therapist) throw new ForbiddenException('Not a therapist');

    const token = randomBytes(24).toString('hex');

    const invite = await this.prisma.invites.create({
      data: {
        therapist_id: therapist.id,
        email,
        token,
        status: InviteStatus.pending,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.log({
      userId: therapistUserId,
      action: 'invite.create',
      entityType: 'invite',
      entityId: invite.id,
    });

    return invite;
  }

  async getInvite(token: string) {
    const inv = await this.prisma.invites.findUnique({ where: { token } });
    if (!inv) throw new NotFoundException('Invite not found');
    return inv;
  }

  /**
   * Validate invite for client registration (must be pending + not expired).
   * Throws 400 with clear message for UX.
   */
  async requireValidInviteForAcceptance(token: string) {
    const inv = await this.prisma.invites.findUnique({ where: { token } });
    if (!inv) throw new NotFoundException('Invite not found');

    if (inv.status !== InviteStatus.pending) {
      throw new BadRequestException('Invite is not pending');
    }

    if (inv.expires_at.getTime() < Date.now()) {
      throw new BadRequestException('Invite has expired');
    }

    if (inv.accepted_client_id) {
      throw new BadRequestException('Invite already accepted');
    }

    return inv;
  }
}

