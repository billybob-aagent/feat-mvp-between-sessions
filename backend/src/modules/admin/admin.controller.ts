import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get("users")
  async listUsers(
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 100);
    return this.admin.listUsers({ limit, cursor: cursor || null });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get("users/:id")
  async getUser(@Param("id") id: string) {
    return this.admin.getUser(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Patch("users/:id/status")
  async updateUserStatus(
    @Param("id") id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.admin.updateUserStatus(id, dto.disabled);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Patch("users/:id/role")
  async updateUserRole(
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.admin.updateUserRole(id, dto.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get("audit")
  async listAudit(
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 100);
    return this.admin.listAudit({ limit, cursor: cursor || null });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get("assignments")
  async listAssignments(
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 100);
    return this.admin.listAssignments({ limit, cursor: cursor || null });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get("notifications")
  async listNotifications(
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 100);
    return this.admin.listNotifications({ limit, cursor: cursor || null });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get("responses")
  async listResponses(
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 100);
    return this.admin.listResponses({ limit, cursor: cursor || null });
  }
}
