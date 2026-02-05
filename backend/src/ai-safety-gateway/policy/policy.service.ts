import { Injectable } from "@nestjs/common";
import { AiPurpose, UserRole } from "@prisma/client";
import { PrismaService } from "../../modules/prisma/prisma.service";

export type PolicyDecision = {
  allowed: boolean;
  denialReason?: string;
};

@Injectable()
export class PolicyService {
  constructor(private prisma: PrismaService) {}

  async evaluate(params: {
    clinicId: string;
    userId: string;
    role: UserRole;
    purpose: AiPurpose;
  }): Promise<PolicyDecision> {
    const settings = await this.prisma.ai_clinic_settings.findUnique({
      where: { clinic_id: params.clinicId },
    });

    if (!settings || !settings.enabled) {
      return { allowed: false, denialReason: "AI_DISABLED" };
    }

    if (settings.allow_client_facing) {
      return { allowed: false, denialReason: "CLIENT_FACING_DISABLED" };
    }

    const roleValue = String(params.role).toLowerCase();
    const allowedRoles = new Set(["admin", "clinic_admin", "therapist"]);
    if (!allowedRoles.has(roleValue)) {
      return { allowed: false, denialReason: "ROLE_NOT_ALLOWED" };
    }

    if (roleValue === "therapist") {
      if (params.purpose === AiPurpose.SUPERVISOR_SUMMARY) {
        return { allowed: false, denialReason: "PURPOSE_NOT_ALLOWED" };
      }
    }

    if (roleValue !== "admin") {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: params.userId, clinic_id: params.clinicId },
      });
      if (!membership) {
        return { allowed: false, denialReason: "CLINIC_ACCESS_REQUIRED" };
      }
    }

    return { allowed: true };
  }
}
