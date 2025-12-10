import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class JwtRolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.['access_token'] || request.headers['authorization']?.toString().replace('Bearer ', '');
    if (!token) return false;
    try {
      const payload = await this.jwt.verifyAsync(token);
      request.user = payload;
      if (!roles || roles.length === 0) return true;
      return roles.includes(payload.role);
    } catch {
      return false;
    }
  }
}
