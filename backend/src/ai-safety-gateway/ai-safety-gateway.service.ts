import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AiPurpose, AiRequestStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../modules/prisma/prisma.service";
import { RedactionService, RedactionStats } from "./redaction/redaction.service";
import { PolicyService } from "./policy/policy.service";
import { hashString } from "./utils/hash";

type ProcessedRequest = {
  allowed: boolean;
  denialReason?: string;
  sanitizedPayload: Record<string, any>;
  redactionStats: RedactionStats;
  sanitizedHash: string;
};

@Injectable()
export class AiSafetyGatewayService {
  constructor(
    private prisma: PrismaService,
    private redaction: RedactionService,
    private policy: PolicyService,
  ) {}

  private async ensureClinicAccess(userId: string, role: UserRole, clinicId: string) {
    if (role === UserRole.admin) return;
    const membership = await this.prisma.clinic_memberships.findFirst({
      where: { user_id: userId, clinic_id: clinicId },
    });
    if (!membership) {
      throw new ForbiddenException("Clinic membership required");
    }
  }

  async processRequest(params: {
    clinicId: string;
    userId: string;
    role: UserRole;
    purpose: AiPurpose;
    payload: Record<string, any>;
    extraRedactionStats?: Partial<RedactionStats>;
  }): Promise<ProcessedRequest> {
    const inputString = JSON.stringify(params.payload) ?? "";
    const inputHash = hashString(inputString);

    const { sanitizedPayload, redactionStats } = this.redaction.redact(params.payload);
    const mergedStats: RedactionStats = {
      ...redactionStats,
      emails: redactionStats.emails + (params.extraRedactionStats?.emails ?? 0),
      phones: redactionStats.phones + (params.extraRedactionStats?.phones ?? 0),
      urls: redactionStats.urls + (params.extraRedactionStats?.urls ?? 0),
      addresses: redactionStats.addresses + (params.extraRedactionStats?.addresses ?? 0),
      ssn: redactionStats.ssn + (params.extraRedactionStats?.ssn ?? 0),
      names: redactionStats.names + (params.extraRedactionStats?.names ?? 0),
    };
    const sanitizedString = JSON.stringify(sanitizedPayload) ?? "";
    const sanitizedHash = hashString(sanitizedString);

    const decision = await this.policy.evaluate({
      clinicId: params.clinicId,
      userId: params.userId,
      role: params.role,
      purpose: params.purpose,
    });

    const status = decision.allowed ? AiRequestStatus.ALLOWED : AiRequestStatus.DENIED;

    await this.prisma.ai_request_logs.create({
      data: {
        clinic_id: params.clinicId,
        user_id: params.userId,
        role: String(params.role),
        purpose: params.purpose,
        status,
        denial_reason: decision.denialReason ?? null,
        input_hash: inputHash,
        sanitized_hash: sanitizedHash,
        redaction_stats: mergedStats as any,
      },
    });

    return {
      allowed: decision.allowed,
      denialReason: decision.denialReason,
      sanitizedPayload: sanitizedPayload as Record<string, any>,
      redactionStats: mergedStats,
      sanitizedHash,
    };
  }

  async dryRun(params: {
    clinicId: string;
    userId: string;
    role: UserRole;
    purpose: AiPurpose;
    payload: Record<string, any>;
  }) {
    const processed = await this.processRequest({
      clinicId: params.clinicId,
      userId: params.userId,
      role: params.role,
      purpose: params.purpose,
      payload: params.payload,
    });

    if (!processed.allowed) {
      return {
        ok: false,
        status: "DENIED",
        denial_reason: processed.denialReason ?? "UNKNOWN",
        redaction_stats: processed.redactionStats,
        sanitized_hash: processed.sanitizedHash,
      };
    }

    return {
      ok: true,
      status: "ALLOWED",
      sanitized_payload: processed.sanitizedPayload,
      redaction_stats: processed.redactionStats,
      sanitized_hash: processed.sanitizedHash,
    };
  }

  async getSettings(params: { clinicId: string; userId: string; role: UserRole }) {
    const clinic = await this.prisma.clinics.findUnique({
      where: { id: params.clinicId },
      select: { id: true },
    });
    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);

    const settings = await this.prisma.ai_clinic_settings.findUnique({
      where: { clinic_id: params.clinicId },
    });

    return {
      clinicId: params.clinicId,
      enabled: settings?.enabled ?? false,
      updatedAt: settings?.updated_at ? settings.updated_at.toISOString() : null,
    };
  }

  async updateSettings(params: {
    clinicId: string;
    userId: string;
    role: UserRole;
    enabled: boolean;
  }) {
    const clinic = await this.prisma.clinics.findUnique({
      where: { id: params.clinicId },
      select: { id: true },
    });
    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    await this.ensureClinicAccess(params.userId, params.role, params.clinicId);

    const settings = await this.prisma.ai_clinic_settings.upsert({
      where: { clinic_id: params.clinicId },
      update: { enabled: params.enabled, allow_client_facing: false },
      create: {
        clinic_id: params.clinicId,
        enabled: params.enabled,
        allow_client_facing: false,
      },
    });

    return {
      clinicId: params.clinicId,
      enabled: settings.enabled,
      updatedAt: settings.updated_at ? settings.updated_at.toISOString() : null,
    };
  }
}
