import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(therapistUserId: string, dto: { clientId: string; promptId: string; dueDate?: string; recurrence?: string }) {
    const therapist = await this.prisma.therapists.findFirst({ where: { user_id: therapistUserId } });
    if (!therapist) throw new ForbiddenException('Not a therapist');
    const client = await this.prisma.clients.findUnique({ where: { id: dto.clientId } });
    if (!client || client.therapist_id !== therapist.id) throw new ForbiddenException('Client not found');
    const prompt = await this.prisma.prompts.findUnique({ where: { id: dto.promptId } });
    if (!prompt || prompt.therapist_id !== therapist.id) throw new ForbiddenException('Prompt not found');
    const assignment = await this.prisma.assignments.create({
      data: {
        therapist_id: therapist.id,
        client_id: client.id,
        prompt_id: prompt.id,
        due_date: dto.dueDate ? new Date(dto.dueDate) : null,
        recurrence: dto.recurrence || null,
      },
    });
    await this.audit.log({ userId: therapistUserId, action: 'assignment.create', entityType: 'assignment', entityId: assignment.id });
    return assignment;
  }

  async listForClient(userId: string) {
    const client = await this.prisma.clients.findFirst({ where: { user_id: userId } });
    if (!client) throw new ForbiddenException('Not a client');
    return this.prisma.assignments.findMany({ where: { client_id: client.id }, orderBy: { created_at: 'desc' } });
  }
}
