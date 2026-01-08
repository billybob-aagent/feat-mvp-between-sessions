import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE } from './auth.constants';
import type { UserRole } from '@prisma/client';

function cookieExtractor(req: Request): string | null {
  return (req?.cookies?.[ACCESS_COOKIE] as string | undefined) ?? null;
}

@Injectable()
export class CookieJwtStrategy extends PassportStrategy(Strategy, 'cookie-jwt') {
  constructor() {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: any): Promise<{ userId: string; role: UserRole }> {
    if (!payload?.sub || !payload?.role) throw new UnauthorizedException();
    return { userId: payload.sub, role: payload.role as UserRole };
  }
}
