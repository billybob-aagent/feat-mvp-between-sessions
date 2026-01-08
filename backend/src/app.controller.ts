import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /api/v1/csrf
  @Get('csrf')
  getCsrf(@Req() req: Request) {
    const csrfTokenFn = (req as any).csrfToken;
    if (typeof csrfTokenFn !== 'function') {
      return { csrfToken: null };
    }
    return { csrfToken: csrfTokenFn() };
  }
}

