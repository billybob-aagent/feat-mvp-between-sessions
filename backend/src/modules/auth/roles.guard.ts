import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No roles specified = allow
    if (!roles || roles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("Missing user context");
    }

    // Our JwtStrategy.validate() returns { userId, role }
    const role = user.role as UserRole | string | undefined;

    if (!role) {
      throw new ForbiddenException("Missing role");
    }

    const normalizedRole = String(role).toLowerCase();
    const ok = roles
      .map((entry) => String(entry).toLowerCase())
      .includes(normalizedRole);
    if (!ok) {
      throw new ForbiddenException("Insufficient role");
    }

    return true;
  }
}
