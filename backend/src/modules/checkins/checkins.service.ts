import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AesGcm } from '../../common/crypto/aes-gcm';

@Injectable()
export class CheckinsService {
  constructor(private prisma: PrismaService) {}

  async submit(userId: string, dto: { mood: number; note?: string }) {
    const client = await this.prisma.clients.findFirst({ where: { user_id: userId } });
    if (!client) throw new ForbiddenException('Not a client');
    let note_cipher: Buffer | undefined;
    let note_nonce: Buffer | undefined;
    let note_tag: Buffer | undefined;
    if (dto.note) {
      const aes = AesGcm.fromEnv();
      const enc = aes.encrypt(dto.note);
      note_cipher = enc.cipher;
      note_nonce = enc.nonce;
      note_tag = enc.tag;
    }
    return this.prisma.checkins.create({
      data: {
        client_id: client.id,
        mood: dto.mood,
        note_cipher: note_cipher || null,
        note_nonce: note_nonce || null,
        note_tag: note_tag || null,
      },
    });
  }
}
