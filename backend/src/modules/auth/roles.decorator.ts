import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './auth.constants';
import type { UserRole } from '@prisma/client';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
