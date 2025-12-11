import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService, private prisma: PrismaService) {}

  @Get()
  @HealthCheck()
  async check() {
    const redisUrl = process.env.REDIS_URL;
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRawUnsafe('SELECT 1');
          return { db: { status: 'up' } } as HealthIndicatorResult;
        } catch {
          return { db: { status: 'down' } } as HealthIndicatorResult;
        }
      },
      async (): Promise<HealthIndicatorResult> => {
        if (!redisUrl) return { redis: { status: 'down' } } as HealthIndicatorResult;
        const client = new Redis(redisUrl);
        try {
          await client.ping();
          return { redis: { status: 'up' } } as HealthIndicatorResult;
        } catch {
          return { redis: { status: 'down' } } as HealthIndicatorResult;
        } finally {
          client.disconnect();
        }
      },
    ]);
  }
}
