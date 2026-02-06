import { ForbiddenException } from "@nestjs/common";
import { AiPurpose, AiRequestStatus, UserRole } from "@prisma/client";
import { AiSafetyGatewayService } from "./ai-safety-gateway.service";
import { RedactionService } from "./redaction/redaction.service";
import { hashString } from "./utils/hash";

const prismaMock = {
  ai_request_logs: { create: jest.fn() },
  clinic_memberships: { findFirst: jest.fn() },
  ai_clinic_settings: { findUnique: jest.fn(), upsert: jest.fn() },
  clinics: { findUnique: jest.fn() },
};

const policyMock = {
  evaluate: jest.fn(),
};

describe("AiSafetyGatewayService", () => {
  let service: AiSafetyGatewayService;
  let redaction: RedactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    redaction = new RedactionService();
    service = new AiSafetyGatewayService(prismaMock as any, redaction, policyMock as any);
  });

  it("logs and returns sanitized payload when allowed", async () => {
    policyMock.evaluate.mockResolvedValue({ allowed: true });

    const payload = { text: "Email test@example.com" };

    const result = await service.dryRun({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      purpose: AiPurpose.DOCUMENTATION,
      payload,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ALLOWED");
    expect(result.sanitized_payload).toEqual({ text: "Email [REDACTED_EMAIL]" });

    const expectedInputHash = hashString(JSON.stringify(payload) ?? "");
    const expectedSanitizedHash = hashString(
      JSON.stringify({ text: "Email [REDACTED_EMAIL]" }) ?? "",
    );

    expect(prismaMock.ai_request_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AiRequestStatus.ALLOWED,
          input_hash: expectedInputHash,
          sanitized_hash: expectedSanitizedHash,
        }),
      }),
    );
  });

  it("does not log raw payload content", async () => {
    policyMock.evaluate.mockResolvedValue({ allowed: true });

    const payload = { text: "Email test@example.com" };

    await service.dryRun({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      purpose: AiPurpose.DOCUMENTATION,
      payload,
    });

    const call = prismaMock.ai_request_logs.create.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("payload");
    expect(call.data).not.toHaveProperty("sanitized_payload");
    expect(JSON.stringify(call.data)).not.toContain("test@example.com");
  });

  it("returns denied without sanitized payload", async () => {
    policyMock.evaluate.mockResolvedValue({ allowed: false, denialReason: "AI_DISABLED" });

    const payload = { text: "Phone 617-555-1212" };

    const result = await service.dryRun({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      purpose: AiPurpose.DOCUMENTATION,
      payload,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("DENIED");
    expect(result.denial_reason).toBe("AI_DISABLED");
    expect((result as any).sanitized_payload).toBeUndefined();

    expect(prismaMock.ai_request_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AiRequestStatus.DENIED,
          denial_reason: "AI_DISABLED",
        }),
      }),
    );
  });

  it("allows therapist to read settings for their clinic", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "mem-1" });
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue({
      enabled: true,
      updated_at: new Date("2026-02-01T12:00:00.000Z"),
    });

    const result = await service.getSettings({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.therapist,
    });

    expect(result.enabled).toBe(true);
    expect(result.updatedAt).toBe("2026-02-01T12:00:00.000Z");
  });

  it("denies therapist settings for other clinic", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue(null);

    await expect(
      service.getSettings({
        clinicId: "clinic-1",
        userId: "user-1",
        role: UserRole.therapist,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows admin settings access without membership", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.ai_clinic_settings.findUnique.mockResolvedValue({
      enabled: false,
      updated_at: new Date("2026-02-02T08:00:00.000Z"),
    });

    const result = await service.getSettings({
      clinicId: "clinic-1",
      userId: "user-1",
      role: UserRole.admin,
    });

    expect(result.enabled).toBe(false);
    expect(result.updatedAt).toBe("2026-02-02T08:00:00.000Z");
  });
});
