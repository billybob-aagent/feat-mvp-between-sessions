import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as argon2 from "argon2";

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

  async createForTherapist(therapistUserId: string, params: {
    email: string;
    fullName: string;
    password: string;
  }) {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: therapistUserId },
      select: { id: true },
    });
    if (!therapist) throw new ForbiddenException("Not a therapist");

    const email = params.email.trim().toLowerCase();
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already registered");

    const password_hash = await argon2.hash(params.password);

    const user = await this.prisma.users.create({
      data: {
        email,
        password_hash,
        role: "client",
        email_verified_at: process.env.EMAIL_ENABLED === "true" ? null : new Date(),
        client: {
          create: {
            full_name: params.fullName.trim(),
            therapist_id: therapist.id,
          },
        },
      },
      include: { client: true },
    });

    return {
      id: user.client!.id,
      fullName: user.client!.full_name,
      email: user.email,
      createdAt: user.client!.created_at,
    };
  }
}
