import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AesGcm } from '../../common/crypto/aes-gcm';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async registerTherapist(params: { email: string; password: string; fullName: string }) {
    const existing = await this.prisma.users.findUnique({ where: { email: params.email } });
    if (existing) throw new BadRequestException('Email already registered');
    const password_hash = await argon2.hash(params.password);
    const user = await this.prisma.users.create({
      data: {
        email: params.email,
        password_hash,
        role: 'therapist',
        email_verified_at: process.env.EMAIL_ENABLED === 'true' ? null : new Date(),
        therapist: {
          create: {
            full_name: params.fullName,
          },
        },
      },
      include: { therapist: true },
    });
    return this.issueTokens(user.id, user.role as UserRole);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.password_hash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    await this.prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    return this.issueTokens(user.id, user.role as UserRole);
  }

  private async issueTokens(userId: string, role: UserRole) {
    const access = await this.jwt.signAsync({ sub: userId, role }, { expiresIn: '15m' });
    const refresh = await this.jwt.signAsync({ sub: userId, role, type: 'refresh' }, { expiresIn: '7d' });
    await this.prisma.sessions.create({ data: { user_id: userId, refresh_token: refresh, valid: true } });
    return { access, refresh };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken);
      if (payload.type !== 'refresh') throw new UnauthorizedException();
      const sess = await this.prisma.sessions.findUnique({ where: { refresh_token: refreshToken } });
      if (!sess || !sess.valid) throw new UnauthorizedException();
      return this.issueTokens(payload.sub, payload.role);
    } catch {
      throw new UnauthorizedException();
    }
  }

  async logout(refreshToken: string) {
    await this.prisma.sessions.update({ where: { refresh_token: refreshToken }, data: { valid: false } }).catch(() => {});
    return { ok: true };
  }
}