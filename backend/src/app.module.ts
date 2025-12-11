import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { InvitesModule } from './modules/invites/invites.module';
import { AuditModule } from './modules/audit/audit.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { ResponsesModule } from './modules/responses/responses.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { CheckinsModule } from './modules/checkins/checkins.module';
import { ClientsModule } from './modules/clients/clients.module';
import { HealthModule } from './modules/health/health.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    InvitesModule,
    ClientsModule,
    PromptsModule,
    AssignmentsModule,
    ResponsesModule,
    FeedbackModule,
    CheckinsModule,
    HealthModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
