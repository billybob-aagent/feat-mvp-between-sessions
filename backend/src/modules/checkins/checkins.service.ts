import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AesGcm } from "../../common/crypto/aes-gcm";

@Injectable()
export class CheckinsService {
  private aes: AesGcm;

  constructor(private prisma: PrismaService) {
    // ✅ single source of truth
    this.aes = AesGcm.fromEnv();
  }

  async submit(userId: string, dto: { mood: number; note?: string }) {
    const client = await this.prisma.clients.findFirst({
      where: { user_id: userId },
    });
    if (!client) throw new ForbiddenException("Not a client");

    const mood = Number(dto.mood);
    const note = dto.note?.trim();

    const enc = note ? this.aes.encrypt(note) : null;

    return this.prisma.checkins.create({
      data: {
        client_id: client.id,
        mood,
        note_cipher: enc ? enc.cipher : null,
        note_nonce: enc ? enc.nonce : null,
        note_tag: enc ? enc.tag : null,
      },
      select: {
        id: true,
        client_id: true,
        mood: true,
        created_at: true,
      },
    });
  }
}
