import { Controller, Get } from '@nestjs/common';

@Controller('csrf')
export class CsrfController {
  @Get()
  getCsrf() {
    // Dev-only helper endpoint so the frontend always has something to call.
    // If CSRF is disabled in dev, the token can be any string.
    return { csrfToken: 'dev-csrf-token' };
  }
}

