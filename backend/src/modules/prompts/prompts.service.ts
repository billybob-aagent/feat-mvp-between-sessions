import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PromptsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(therapistUserId: string, title: string, content: string) {
    const therapist = await this.prisma.therapists.findFirst({ where: { user_id: therapistUserId } });
    if (!therapist) throw new ForbiddenException('Not a therapist');
    const p = await this.prisma.prompts.create({ data: { therapist_id: therapist.id, title, content } });
    await this.audit.log({ userId: therapistUserId, action: 'prompt.create', entityType: 'prompt', entityId: p.id });
    return p;
  }

  async list(therapistUserId: string) {
    const therapist = await this.prisma.therapists.findFirst({ where: { user_id: therapistUserId } });
    if (!therapist) throw new ForbiddenException('Not a therapist');
    return this.prisma.prompts.findMany({ where: { therapist_id: therapist.id }, orderBy: { created_at: 'desc' } });
  }
}
