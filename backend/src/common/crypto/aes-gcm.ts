import * as crypto from "crypto";

const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 12; // 96-bit nonce for GCM

export class AesGcm {
  constructor(private key: Buffer) {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`AES-256-GCM key must be 32 bytes (got ${key.length})`);
    }
  }

  static fromEnv(): AesGcm {
    const raw = process.env.APP_ENCRYPTION_KEY;

    if (!raw || raw.trim().length === 0) {
      throw new Error(
        "APP_ENCRYPTION_KEY missing. Set a base64-encoded 32-byte key in backend/.env",
      );
    }

    const keyB64 = raw.trim();

    let key: Buffer;
    try {
      key = Buffer.from(keyB64, "base64");
    } catch {
      throw new Error("APP_ENCRYPTION_KEY is not valid base64");
    }

    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `APP_ENCRYPTION_KEY must decode to 32 bytes. Your value decodes to ${key.length} bytes.`,
      );
    }

    return new AesGcm(key);
  }

  static generateKeyBase64(): string {
    return crypto.randomBytes(KEY_LENGTH).toString("base64");
  }

  encrypt(plaintext: string): { cipher: Buffer; nonce: Buffer; tag: Buffer } {
    const nonce = crypto.randomBytes(NONCE_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, nonce);

    const enc = Buffer.concat([
      cipher.update(Buffer.from(plaintext, "utf8")),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();
    return { cipher: enc, nonce, tag };
  }

  decrypt(cipherText: Buffer, nonce: Buffer, tag: Buffer): string {
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, nonce);
    decipher.setAuthTag(tag);

    const dec = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return dec.toString("utf8");
  }
}



