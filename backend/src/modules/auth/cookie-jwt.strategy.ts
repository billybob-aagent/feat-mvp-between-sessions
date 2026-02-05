import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
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
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: any): Promise<{ userId: string; role: UserRole }> {
    if (!payload?.sub || !payload?.role) throw new UnauthorizedException();
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, is_disabled: true },
    });
    if (!user || user.is_disabled) throw new UnauthorizedException();
    return { userId: user.id, role: user.role as UserRole };
  }
}
