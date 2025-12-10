import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    await this.prisma.audit_logs.create({
      data: {
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        ip: params.ip,
        user_agent: params.userAgent,
        metadata: params.metadata as any,
      },
    });
  }
}
