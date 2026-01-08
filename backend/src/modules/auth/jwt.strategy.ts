import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

type JwtPayload = {
  sub: string;          // user id
  role: string;         // 'client' | 'therapist' | etc
  iat?: number;
  exp?: number;
};

function cookieExtractor(req: Request): string | null {
  // Requires cookie-parser middleware (we’ll add in main.ts)
  return req?.cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret =
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      '';

    if (!secret) {
      // If this throws on boot, set one of these env vars and restart:
      // JWT_ACCESS_SECRET or JWT_SECRET
      throw new Error('Missing JWT secret: set JWT_ACCESS_SECRET or JWT_SECRET');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      secretOrKey: secret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // Standardize what goes on req.user for controllers/guards
    return {
      userId: payload.sub,
      role: payload.role,
    };
  }
}
