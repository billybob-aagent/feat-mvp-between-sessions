import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InvitesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async createInvite(therapistUserId: string, email: string) {
    const therapist = await this.prisma.therapists.findFirst({ where: { user_id: therapistUserId } });
    if (!therapist) throw new ForbiddenException('Not a therapist');
    const token = randomBytes(24).toString('hex');
    const invite = await this.prisma.invites.create({
      data: {
        therapist_id: therapist.id,
        email,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await this.audit.log({ userId: therapistUserId, action: 'invite.create', entityType: 'invite', entityId: invite.id });
    return invite;
  }

  async getInvite(token: string) {
    const inv = await this.prisma.invites.findUnique({ where: { token } });
    if (!inv) throw new NotFoundException('Invite not found');
    return inv;
  }
}
