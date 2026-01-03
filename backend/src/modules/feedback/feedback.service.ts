import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AesGcm } from '../../common/crypto/aes-gcm';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async create(therapistUserId: string, dto: { responseId: string; text: string }) {
    const therapist = await this.prisma.therapists.findFirst({ where: { user_id: therapistUserId } });
    if (!therapist) throw new ForbiddenException('Not a therapist');
    const response = await this.prisma.responses.findUnique({ where: { id: dto.responseId } });
    if (!response) throw new ForbiddenException('Response not found');
    const assignment = await this.prisma.assignments.findUnique({ where: { id: response.assignment_id } });
    if (!assignment || assignment.therapist_id !== therapist.id) throw new ForbiddenException('Not your client');
    const aes = AesGcm.fromEnv();
    const enc = aes.encrypt(dto.text);
    return this.prisma.feedback.create({
      data: {
        response_id: response.id,
        therapist_id: therapist.id,
        text_cipher: enc.cipher,
        text_nonce: enc.nonce,
        text_tag: enc.tag,
      },
    });
  }

  async listForResponse(therapistUserId: string, responseId: string) {
    const therapist = await this.prisma.therapists.findFirst({ where: { user_id: therapistUserId } });
    if (!therapist) throw new ForbiddenException('Not a therapist');
    const response = await this.prisma.responses.findUnique({ where: { id: responseId } });
    const assignment = response ? await this.prisma.assignments.findUnique({ where: { id: response.assignment_id } }) : null;
    if (!response || !assignment || assignment.therapist_id !== therapist.id) throw new ForbiddenException('Not your client');
    return this.prisma.feedback.findMany({ where: { response_id: responseId } });
  }
}