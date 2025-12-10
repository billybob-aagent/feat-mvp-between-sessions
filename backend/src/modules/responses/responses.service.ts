import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AesGcm } from '../../common/crypto/aes-gcm';

@Injectable()
export class ResponsesService {
  constructor(private prisma: PrismaService) {}

  async submit(userId: string, dto: { assignmentId: string; text: string; voiceKey?: string }) {
    const client = await this.prisma.clients.findFirst({ where: { user_id: userId } });
    if (!client) throw new ForbiddenException('Not a client');
    const assignment = await this.prisma.assignments.findUnique({ where: { id: dto.assignmentId } });
    if (!assignment || assignment.client_id !== client.id) throw new ForbiddenException('Invalid assignment');

    const aes = AesGcm.fromEnv();
    const enc = aes.encrypt(dto.text);
    const resp = await this.prisma.responses.create({
      data: {
        assignment_id: assignment.id,
        client_id: client.id,
        text_cipher: enc.cipher,
        text_nonce: enc.nonce,
        text_tag: enc.tag,
        voice_storage_key: dto.voiceKey || null,
      },
    });
    return resp;
  }

  async listForAssignment(therapistUserId: string, assignmentId: string) {
    const therapist = await this.prisma.therapists.findFirst({ where: { user_id: therapistUserId } });
    if (!therapist) throw new ForbiddenException('Not a therapist');
    const assignment = await this.prisma.assignments.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.therapist_id !== therapist.id) throw new ForbiddenException('Invalid assignment');
    return this.prisma.responses.findMany({ where: { assignment_id: assignmentId }, orderBy: { created_at: 'asc' } });
  }
}
