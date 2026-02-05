import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";

type JwtPayload = {
  sub: string; // user id
  role: string; // 'client' | 'therapist' | etc
  type?: string; // 'access' | 'refresh'
  iat?: number;
  exp?: number;
};

function cookieExtractor(req: Request): string | null {
  return (req?.cookies?.access_token as string | undefined) ?? null;
}

@Injectable()
export class CookieJwtStrategy extends PassportStrategy(Strategy, "cookie-jwt") {
  constructor() {
    const secret =
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      "";

    if (!secret) {
      throw new Error("Missing JWT secret: set JWT_ACCESS_SECRET or JWT_SECRET");
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: secret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException("Invalid token");
    }

    // Optional safety: ensure we're not accepting refresh tokens as access
    if (payload.type && payload.type !== "access") {
      throw new UnauthorizedException("Invalid token type");
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  }
}

