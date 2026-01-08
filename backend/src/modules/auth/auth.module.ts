import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CookieJwtStrategy } from './cookie-jwt.strategy';
import { InvitesModule } from '../invites/invites.module';

@Module({
  imports: [
    PrismaModule,
    InvitesModule,
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, CookieJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
