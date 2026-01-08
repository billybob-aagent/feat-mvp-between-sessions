import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AesGcm } from '../../common/crypto/aes-gcm';
import { SubmitResponseDto } from './dto/submit-response.dto';

type SubmitResponseResult = {
  id: string;
  assignment_id: string;
  client_id: string;
  voice_storage_key: string | null;
};

type TherapistResponseListItem = {
  id: string;
  created_at: Date | string;
  voice_storage_key: string | null;
};

type TherapistDecryptedResponse = {
  id: string;
  createdAt: Date | string;
  assignmentId: string;
  clientId: string;
  text: string;
  voiceKey: string | null;
};

@Injectable()
export class ResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------
  // Client flow: submit response
  // ---------------------------
  async submit(userId: string, dto: SubmitResponseDto): Promise<SubmitResponseResult> {
    const client = await this.prisma.clients.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!client) {
      throw new ForbiddenException('Not a client');
    }

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: dto.assignmentId },
      select: { id: true, client_id: true },
    });

    if (!assignment || assignment.client_id !== client.id) {
      throw new ForbiddenException('Invalid assignment');
    }

    const aes = AesGcm.fromEnv();
    const enc = aes.encrypt(dto.text);

    const resp = await this.prisma.responses.create({
      data: {
        assignment_id: assignment.id,
        client_id: client.id,
        text_cipher: enc.cipher,
        text_nonce: enc.nonce,
        text_tag: enc.tag,
        voice_storage_key: dto.voiceKey ?? null,
      },
      select: {
        id: true,
        assignment_id: true,
        client_id: true,
        voice_storage_key: true,
      },
    });

    return resp;
  }

  // -----------------------------------------
  // Therapist flow: list responses by assignment
  // -----------------------------------------
  async listForAssignmentTherapist(
    userId: string,
    assignmentId: string,
  ): Promise<{ assignmentId: string; responses: TherapistResponseListItem[] }> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!therapist) {
      throw new ForbiddenException('Not a therapist');
    }

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: { id: true, therapist_id: true },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException('Not your assignment');
    }

    const responses = await this.prisma.responses.findMany({
      where: { assignment_id: assignmentId },
      orderBy: { created_at: 'desc' }, // if your field is createdAt, change this
      select: {
        id: true,
        created_at: true,
        voice_storage_key: true,
      },
    });

    return { assignmentId, responses };
  }

  // -----------------------------------------
  // Therapist flow: decrypt + view one response
  // -----------------------------------------
  async getDecryptedTherapist(
    userId: string,
    responseId: string,
  ): Promise<TherapistDecryptedResponse> {
    const therapist = await this.prisma.therapists.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!therapist) {
      throw new ForbiddenException('Not a therapist');
    }

    const resp = await this.prisma.responses.findUnique({
      where: { id: responseId },
      select: {
        id: true,
        created_at: true,
        assignment_id: true,
        client_id: true,
        voice_storage_key: true,
        text_cipher: true,
        text_nonce: true,
        text_tag: true,
      },
    });

    if (!resp) {
      throw new NotFoundException('Response not found');
    }

    const assignment = await this.prisma.assignments.findUnique({
      where: { id: resp.assignment_id },
      select: { therapist_id: true },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.therapist_id !== therapist.id) {
      throw new ForbiddenException('Not your assignment');
    }

    const aes = AesGcm.fromEnv();

    let text: string;
    try {
      text = aes.decrypt(resp.text_cipher, resp.text_nonce, resp.text_tag);
    } catch {
      // Avoid leaking crypto internals
      throw new ForbiddenException('Unable to decrypt response');
    }

    return {
      id: resp.id,
      createdAt: resp.created_at,
      assignmentId: resp.assignment_id,
      clientId: resp.client_id,
      text,
      voiceKey: resp.voice_storage_key,
    };
  }
}
