import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "../prisma/prisma.module";
import { InvitesModule } from "../invites/invites.module";
import { AuditModule } from "../audit/audit.module";

import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { CookieJwtStrategy } from "./cookie-jwt.strategy";

@Module({
  imports: [
    PrismaModule,
    InvitesModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: "cookie-jwt" }),

    // Global JWT config (used by AuthService signAsync unless overridden)
    JwtModule.register({
      global: true,
      // ✅ IMPORTANT: make sure this matches what cookie-jwt.strategy verifies with
      // Prefer JWT_ACCESS_SECRET if present, else JWT_SECRET
      secret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "dev-secret",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, CookieJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
