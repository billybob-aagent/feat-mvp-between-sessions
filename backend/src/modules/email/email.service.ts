import { Injectable, Logger } from "@nestjs/common";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    // SES disabled in this build to avoid missing dependency errors.
  }

  async sendTransactional(input: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean }> {
    void input;
    this.logger.warn("Email send skipped (SES disabled).");
    return { ok: false, skipped: true };
  }
}
