import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterTherapistDto } from './register-therapist.dto';
import { RegisterClientDto } from './register-client.dto';
import { LoginDto } from './login.dto';
import { JwtService } from '@nestjs/jwt';

function baseCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @Get('csrf')
  csrf(@Req() req: Request) {
    const token =
      typeof (req as any).csrfToken === 'function' ? (req as any).csrfToken() : null;
    return { csrfToken: token };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException('Not authenticated');

    try {
      const payload = await this.jwt.verifyAsync(token);
      return { authenticated: true, userId: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException('Not authenticated');
    }
  }

  @Post('register-therapist')
  async registerTherapist(
    @Body() dto: RegisterTherapistDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.registerTherapist(dto);

    res.cookie('access_token', access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Post('register-client')
  async registerClient(
    @Body() dto: RegisterClientDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.registerClientFromInvite(dto);

    res.cookie('access_token', access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.login(dto.email, dto.password);

    res.cookie('access_token', access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies?.refresh_token as string | undefined) ?? '';
    const { access, refresh } = await this.auth.refresh(refreshToken);

    res.cookie('access_token', access, { ...baseCookieOptions(), maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { ok: true };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies?.refresh_token as string | undefined) ?? '';
    await this.auth.logout(refreshToken).catch(() => {});

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { ok: true };
  }
}


