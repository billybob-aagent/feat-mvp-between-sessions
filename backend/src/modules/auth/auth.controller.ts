import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';

class RegisterTherapistDto {
  email!: string;
  password!: string;
  fullName!: string;
}

class LoginDto {
  email!: string;
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register-therapist')
  async register(@Body() dto: RegisterTherapistDto, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.registerTherapist(dto);
    this.setAuthCookies(res, access, refresh);
    return { ok: true };
  }

  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.login(dto.email, dto.password);
    this.setAuthCookies(res, access, refresh);
    return { ok: true };
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.refresh(refreshToken);
    this.setAuthCookies(res, access, refresh);
    return { ok: true };
  }

  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshToken);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { ok: true };
  }

  private setAuthCookies(res: Response, access: string, refresh: string) {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('access_token', access, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
