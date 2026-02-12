import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE } from './auth.constants';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function cookieExtractor(req: Request): string | null {
  return (req?.cookies?.[ACCESS_COOKIE] as string | undefined) ?? null;
}

@Injectable()
export class CookieJwtStrategy extends PassportStrategy(Strategy, 'cookie-jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_SECRET ||
        'dev-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any): Promise<{
    id: string;
    userId: string;
    role: UserRole;
    clinicId: string | null;
  }> {
    const tokenSource = req?.headers?.authorization?.startsWith('Bearer ')
      ? 'bearer'
      : req?.cookies?.[ACCESS_COOKIE]
        ? 'cookie'
        : 'unknown';
    console.log('access-token', tokenSource, {
      sub: payload?.sub,
      role: payload?.role,
      type: payload?.type,
    });

    if (!payload?.sub || !payload?.role) throw new UnauthorizedException();
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, is_disabled: true },
    });
    if (!user || user.is_disabled) throw new UnauthorizedException();

    let clinicId: string | null = null;
    const role = user.role as UserRole;
    if (role === 'CLINIC_ADMIN') {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: user.id },
        select: { clinic_id: true },
      });
      clinicId = membership?.clinic_id ?? null;
    } else if (role === 'therapist') {
      const therapist = await this.prisma.therapists.findFirst({
        where: { user_id: user.id },
        select: { clinic_id: true },
      });
      clinicId = therapist?.clinic_id ?? null;
    } else if (role === 'client') {
      const client = await this.prisma.clients.findFirst({
        where: { user_id: user.id },
        select: { therapist: { select: { clinic_id: true } } },
      });
      clinicId = client?.therapist?.clinic_id ?? null;
    }

    return { id: user.id, userId: user.id, role, clinicId };
  }
}
