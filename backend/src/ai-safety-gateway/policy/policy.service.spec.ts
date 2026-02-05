import { AiPurpose, UserRole } from "@prisma/client";
import { PolicyService } from "./policy.service";

const prismaMock = {
  ai_clinic_settings: { findUnique: jest.fn() },
  clinic_memberships: { findFirst: jest.fn() },
};

describe("PolicyService", () => {
  let service: PolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PolicyService(prismaMock as any);
  });

  it("denies when AI settings are missing", async () => {
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue(null);

    const result = await service.evaluate({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      purpose: AiPurpose.DOCUMENTATION,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("AI_DISABLED");
  });

  it("denies when AI is disabled", async () => {
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue({
      enabled: false,
      allow_client_facing: false,
    });

    const result = await service.evaluate({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      purpose: AiPurpose.DOCUMENTATION,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("AI_DISABLED");
  });

  it("denies when role not allowed", async () => {
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue({
      enabled: true,
      allow_client_facing: false,
    });

    const result = await service.evaluate({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.client,
      purpose: AiPurpose.DOCUMENTATION,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("ROLE_NOT_ALLOWED");
  });

  it("denies therapist for supervisor summary", async () => {
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue({
      enabled: true,
      allow_client_facing: false,
    });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });

    const result = await service.evaluate({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.therapist,
      purpose: AiPurpose.SUPERVISOR_SUMMARY,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("PURPOSE_NOT_ALLOWED");
  });

  it("allows admin with enabled settings", async () => {
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue({
      enabled: true,
      allow_client_facing: false,
    });

    const result = await service.evaluate({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.admin,
      purpose: AiPurpose.SUPERVISOR_SUMMARY,
    });

    expect(result.allowed).toBe(true);
  });

  it("denies when clinic membership missing", async () => {
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue({
      enabled: true,
      allow_client_facing: false,
    });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue(null);

    const result = await service.evaluate({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      purpose: AiPurpose.DOCUMENTATION,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("CLINIC_ACCESS_REQUIRED");
  });
});
