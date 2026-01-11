import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { UserRole, InviteStatus, Prisma } from "@prisma/client";
import { InvitesService } from "../invites/invites.service";
import { randomUUID } from "crypto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private invites: InvitesService,
  ) {}

  async registerTherapist(params: {
    email: string;
    password: string;
    fullName: string;
  }) {
    const existing = await this.prisma.users.findUnique({
      where: { email: params.email },
    });
    if (existing) throw new BadRequestException("Email already registered");

    const password_hash = await argon2.hash(params.password);

    const user = await this.prisma.users.create({
      data: {
        email: params.email,
        password_hash,
        role: UserRole.therapist,
        email_verified_at:
          process.env.EMAIL_ENABLED === "true" ? null : new Date(),
        therapist: {
          create: {
            full_name: params.fullName,
          },
        },
      },
      include: { therapist: true },
    });

    return this.issueTokens(user.id, user.role as UserRole);
  }

  /**
   * Register a client using an invite token.
   * - invite must be pending + not expired
   * - email is taken from invite
   * - creates users + clients rows
   * - marks invite accepted + links accepted_client_id
   */
  async registerClientFromInvite(params: {
    token: string;
    password: string;
    fullName: string;
  }) {
    const invite = await this.invites.requireValidInviteForAcceptance(
      params.token,
    );

    // Prevent email collisions
    const existing = await this.prisma.users.findUnique({
      where: { email: invite.email },
    });
    if (existing) throw new BadRequestException("Email already registered");

    const password_hash = await argon2.hash(params.password);

    const result = await this.prisma.$transaction(async (tx) => {
      // Create client user
      const user = await tx.users.create({
        data: {
          email: invite.email,
          password_hash,
          role: UserRole.client,
          email_verified_at:
            process.env.EMAIL_ENABLED === "true" ? null : new Date(),
          client: {
            create: {
              full_name: params.fullName,
              therapist_id: invite.therapist_id,
            },
          },
        },
        include: { client: true },
      });

      // Mark invite accepted + link accepted_client_id
      await tx.invites.update({
        where: { id: invite.id },
        data: {
          status: InviteStatus.accepted,
          accepted_client_id: user.client!.id,
        },
      });

      return user;
    });

    return this.issueTokens(result.id, result.role as UserRole);
  }

  async registerClinicAdmin(params: {
    email: string;
    password: string;
    clinicName: string;
    timezone?: string;
  }) {
    const email = params.email.trim().toLowerCase();
    const clinicName = params.clinicName.trim();
    const timezone = params.timezone?.trim() || "UTC";

    const existing = await this.prisma.users.findUnique({
      where: { email },
    });
    if (existing) throw new BadRequestException("Email already registered");

    const password_hash = await argon2.hash(params.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const clinic = await tx.clinics.create({
          data: {
            name: clinicName,
            timezone,
          },
        });

        const createdUser = await tx.users.create({
          data: {
            email,
            password_hash,
            role: UserRole.CLINIC_ADMIN,
            email_verified_at:
              process.env.EMAIL_ENABLED === "true" ? null : new Date(),
          },
        });

        await tx.clinic_memberships.create({
          data: {
            clinic_id: clinic.id,
            user_id: createdUser.id,
            role: "ADMIN",
          },
        });

        return createdUser;
      });

      return this.issueTokens(user.id, user.role as UserRole);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2021" || err.code === "P2022") {
          throw new BadRequestException(
            "Clinic signup is not ready. Apply the latest database migrations.",
          );
        }
      }
      if (err instanceof Prisma.PrismaClientUnknownRequestError) {
        throw new BadRequestException(
          "Clinic signup failed. Apply the latest database migrations and try again.",
        );
      }
      throw err;
    }
  }

  async lookupClinicTherapistInvite(token: string) {
    const inv = await this.prisma.clinic_therapist_invites.findUnique({
      where: { token },
    });
    if (!inv) throw new BadRequestException("Invalid invite");

    const isExpired = inv.expires_at.getTime() < Date.now();
    return {
      email: inv.email,
      status: inv.status,
      expires_at: inv.expires_at,
      isExpired,
    };
  }

  async registerClinicTherapistFromInvite(params: {
    token: string;
    password: string;
    fullName: string;
    organization?: string;
    timezone?: string;
  }) {
    const invite = await this.prisma.clinic_therapist_invites.findUnique({
      where: { token: params.token },
    });
    if (!invite) throw new BadRequestException("Invalid invite");
    if (invite.status !== InviteStatus.pending) {
      throw new BadRequestException("Invite is not pending");
    }
    if (invite.expires_at.getTime() < Date.now()) {
      throw new BadRequestException("Invite expired");
    }

    const existing = await this.prisma.users.findUnique({
      where: { email: invite.email },
    });
    if (existing) throw new BadRequestException("Email already registered");

    const password_hash = await argon2.hash(params.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          email: invite.email,
          password_hash,
          role: UserRole.therapist,
          email_verified_at:
            process.env.EMAIL_ENABLED === "true" ? null : new Date(),
          therapist: {
            create: {
              full_name: params.fullName.trim(),
              organization: params.organization?.trim() || null,
              timezone: params.timezone?.trim() || "UTC",
              clinic_id: invite.clinic_id,
            },
          },
        },
        include: { therapist: true },
      });

      await tx.clinic_therapist_invites.update({
        where: { id: invite.id },
        data: {
          status: InviteStatus.accepted,
          accepted_user_id: user.id,
        },
      });

      return user;
    });

    return this.issueTokens(result.id, result.role as UserRole);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (user.is_disabled) throw new UnauthorizedException("Account disabled");

    const ok = await argon2.verify(user.password_hash, password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    await this.prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const { access, refresh } = await this.issueTokens(
      user.id,
      user.role as UserRole,
    );
    return { access, refresh, userId: user.id };
  }

  /**
   * Issues access + refresh tokens.
   *
   * If `existingRefreshToken` is provided, we ROTATE the session by updating
   * the existing row instead of creating a new session row.
   */
  private async issueTokens(
    userId: string,
    role: UserRole,
    existingRefreshToken?: string,
  ) {
    const access = await this.jwt.signAsync(
      { sub: userId, role, type: "access" },
      { expiresIn: "15m" },
    );

    // ✅ Make refresh token unique every time
    const refresh = await this.jwt.signAsync(
      { sub: userId, role, type: "refresh", jti: randomUUID() },
      { expiresIn: "7d" },
    );

    if (existingRefreshToken) {
      // ✅ Rotate: update the existing session row
      await this.prisma.sessions.update({
        where: { refresh_token: existingRefreshToken },
        data: {
          refresh_token: refresh,
          valid: true,
          last_seen_at: new Date(),
        },
      });
    } else {
      // ✅ First issuance: create a new session row
      await this.prisma.sessions.create({
        data: { user_id: userId, refresh_token: refresh, valid: true },
      });
    }

    return { access, refresh };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException();

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException();
    }

    if (payload.type !== "refresh" || !payload.sub) {
      throw new UnauthorizedException();
    }

    const sess = await this.prisma.sessions.findUnique({
      where: { refresh_token: refreshToken },
    });
    if (!sess || !sess.valid) throw new UnauthorizedException();

    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, is_disabled: true },
    });
    if (!user || user.is_disabled) throw new UnauthorizedException();

    // ✅ Rotate tokens AND update that session row
    return this.issueTokens(user.id, user.role as UserRole, refreshToken);
  }

  async logout(refreshToken: string) {
    let userId: string | null = null;
    if (refreshToken) {
      const sess = await this.prisma.sessions.findUnique({
        where: { refresh_token: refreshToken },
        select: { user_id: true },
      });
      userId = sess?.user_id ?? null;
    }

    await this.prisma.sessions
      .update({
        where: { refresh_token: refreshToken },
        data: { valid: false },
      })
      .catch(() => {});
    return { ok: true, userId };
  }
}
