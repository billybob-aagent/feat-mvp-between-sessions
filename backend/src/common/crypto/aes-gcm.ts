import crypto from 'crypto';

const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 12; // 96-bit nonce for GCM

export class AesGcm {
  constructor(private key: Buffer) {
    if (key.length !== KEY_LENGTH) {
      throw new Error('AES-256-GCM key must be 32 bytes');
    }
  }

  static fromEnv(): AesGcm {
    const keyB64 = process.env.APP_ENCRYPTION_KEY;
    if (!keyB64) throw new Error('APP_ENCRYPTION_KEY missing');
    const key = Buffer.from(keyB64, 'base64');
    return new AesGcm(key);
  }

  encrypt(plaintext: string): { cipher: Buffer; nonce: Buffer; tag: Buffer } {
    const nonce = crypto.randomBytes(NONCE_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, nonce);
    const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { cipher: enc, nonce, tag };
  }

  decrypt(cipher: Buffer, nonce: Buffer, tag: Buffer): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, nonce);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(cipher), decipher.final()]);
    return dec.toString('utf8');
  }
}