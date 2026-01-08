import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Return list of clients for a therapist, by therapist USER id (not therapist table id).
   */
  async listForTherapist(therapistUserId: string) {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });

    if (!therapist) throw new ForbiddenException('Not a therapist');

    const clients = await this.prisma.clients.findMany({
      where: { therapist_id: therapist.id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        full_name: true,
        created_at: true,
        user: { select: { email: true } },
      },
    });

    // Small, frontend-friendly shape
    return clients.map((c) => ({
      id: c.id,
      fullName: c.full_name,
      email: c.user.email,
      createdAt: c.created_at,
    }));
  }
}
