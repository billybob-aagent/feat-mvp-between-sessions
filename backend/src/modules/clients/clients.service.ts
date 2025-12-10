import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async acceptInvite(dto: { token: string; password: string; fullName: string }) {
    const invite = await this.prisma.invites.findUnique({ where: { token: dto.token } });
    if (!invite || invite.status !== 'pending' || invite.expires_at < new Date())
      throw new NotFoundException('Invite invalid');
    const therapist = await this.prisma.therapists.findUnique({ where: { id: invite.therapist_id } });
    if (!therapist) throw new BadRequestException('Therapist not found');

    const existingUser = await this.prisma.users.findUnique({ where: { email: invite.email } });
    if (existingUser) throw new BadRequestException('Email already registered');

    const password_hash = await argon2.hash(dto.password);
    const user = await this.prisma.users.create({
      data: {
        email: invite.email,
        password_hash,
        role: 'client',
        email_verified_at: new Date(),
        client: {
          create: {
            therapist_id: therapist.id,
            full_name: dto.fullName,
          },
        },
      },
      include: { client: true },
    });

    await this.prisma.invites.update({ where: { id: invite.id }, data: { status: 'accepted', accepted_client_id: user.client!.id } });
    return { ok: true };
  }
}
