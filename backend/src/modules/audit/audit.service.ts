import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditLogDto = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
};

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

  async listForUser(params: {
    userId: string;
    limit: number;
    cursor: string | null;
  }): Promise<{ items: AuditLogDto[]; nextCursor: string | null }> {
    const rows = await this.prisma.audit_logs.findMany({
      where: { user_id: params.userId },
      orderBy: { id: 'desc' },
      take: params.limit + 1,
      ...(params.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = rows.length > params.limit;
    const sliced = hasMore ? rows.slice(0, params.limit) : rows;

    const items = sliced.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type ?? null,
      entityId: row.entity_id ?? null,
      ip: row.ip ?? null,
      userAgent: row.user_agent ?? null,
      metadata: (row.metadata as Record<string, any> | null) ?? null,
      createdAt: row.created_at.toISOString(),
    }));

    return {
      items,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }
}
