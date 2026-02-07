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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ClinicModule } from './modules/clinic/clinic.module';
import { LibraryModule } from './modules/library/library.module';
import { AerReportModule } from './reports/aer/aer-report.module';
import { AerRollupModule } from './reports/aer-rollup/aer-rollup.module';
import { AerBundleModule } from './reports/aer-bundle/aer-bundle.module';
import { ExternalAccessModule } from './modules/external-access/external-access.module';
import { SupervisorWeeklyPacketModule } from './reports/supervisor-weekly-packet/supervisor-weekly-packet.module';
import { SupervisorActionsModule } from './supervisor-actions/supervisor-actions.module';
import { AiSafetyGatewayModule } from './ai-safety-gateway/ai-safety-gateway.module';
import { AiAssistModule } from './ai-assist/ai-assist.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { ReviewQueueModule } from './modules/review-queue/review-queue.module';
import { TraceModule } from './modules/trace/trace.module';

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
    NotificationsModule,
    AdminModule,
    ClinicModule,
    LibraryModule,
    AerReportModule,
    AerRollupModule,
    AerBundleModule,
    ExternalAccessModule,
    SupervisorWeeklyPacketModule,
    SupervisorActionsModule,
    AiSafetyGatewayModule,
    AiAssistModule,
    MetricsModule,
    ReviewQueueModule,
    TraceModule,
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
