import { ExternalAccessService } from "./external-access.service";
import { createHash } from "crypto";

const prismaMock = {
  clinics: { findUnique: jest.fn() },
  clinic_memberships: { findFirst: jest.fn() },
  clients: { findUnique: jest.fn() },
  external_access_tokens: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  external_access_token_uses: { create: jest.fn() },
};

const aerReportMock = {
  generateAerReport: jest.fn(),
};

const aerPdfMock = {
  generatePdfReport: jest.fn(),
};

describe("ExternalAccessService", () => {
  let service: ExternalAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExternalAccessService(prismaMock as any, aerReportMock as any, aerPdfMock as any);
  });

  it("hashes tokens and looks them up by hash", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-04T12:00:00.000Z"));

    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });

    const expectedExpiresAt = new Date("2026-02-04T13:00:00.000Z");
    prismaMock.external_access_tokens.create.mockResolvedValue({
      id: "token-1",
      report_type: "AER_JSON",
      expires_at: expectedExpiresAt,
    });

    const created = await service.createAerToken({
      userId: "user-1",
      role: "CLINIC_ADMIN" as any,
      clinicId: "clinic-1",
      clientId: "client-1",
      start: "2026-01-01",
      end: "2026-01-31",
      program: null,
      format: "json",
      ttlMinutes: 60,
    });

    const rawToken = created.url.split("token=")[1];
    const createData = prismaMock.external_access_tokens.create.mock.calls[0][0].data;
    expect(createData.token_hash).not.toBe(rawToken);

    prismaMock.external_access_tokens.findFirst.mockResolvedValue({
      id: "token-1",
      clinic_id: "clinic-1",
      client_id: "client-1",
      report_type: "AER_JSON",
      period_start: new Date("2026-01-01T00:00:00.000Z"),
      period_end: new Date("2026-01-31T00:00:00.000Z"),
      program: null,
      expires_at: new Date("2026-02-05T00:00:00.000Z"),
      revoked_at: null,
    });

    aerReportMock.generateAerReport.mockResolvedValue({
      meta: { report_type: "AER" },
      audit_integrity: { report_id: "report-1" },
    });

    await service.getAerJsonFromToken(rawToken, { path: "/api/v1/external/aer.json" });

    const expectedHash = createHash("sha256").update(rawToken).digest("hex");
    expect(prismaMock.external_access_tokens.findFirst).toHaveBeenCalledWith({
      where: { token_hash: expectedHash, report_type: "AER_JSON" },
    });

    jest.useRealTimers();
  });

  it("rejects expired tokens", async () => {
    prismaMock.external_access_tokens.findFirst.mockResolvedValue({
      id: "token-2",
      clinic_id: "clinic-1",
      client_id: "client-1",
      report_type: "AER_JSON",
      period_start: new Date("2026-01-01T00:00:00.000Z"),
      period_end: new Date("2026-01-31T00:00:00.000Z"),
      program: null,
      expires_at: new Date("2026-01-10T00:00:00.000Z"),
      revoked_at: null,
    });

    await expect(
      service.getAerJsonFromToken("expired-token", { path: "/api/v1/external/aer.json" }),
    ).rejects.toThrow("Invalid or expired token");

    expect(prismaMock.external_access_token_uses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status_code: 401 }),
      }),
    );
  });

  it("rejects revoked tokens", async () => {
    prismaMock.external_access_tokens.findFirst.mockResolvedValue({
      id: "token-3",
      clinic_id: "clinic-1",
      client_id: "client-1",
      report_type: "AER_JSON",
      period_start: new Date("2026-01-01T00:00:00.000Z"),
      period_end: new Date("2026-01-31T00:00:00.000Z"),
      program: null,
      expires_at: new Date("2026-02-10T00:00:00.000Z"),
      revoked_at: new Date("2026-02-01T00:00:00.000Z"),
    });

    await expect(
      service.getAerJsonFromToken("revoked-token", { path: "/api/v1/external/aer.json" }),
    ).rejects.toThrow("Invalid or expired token");

    expect(prismaMock.external_access_token_uses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status_code: 401 }),
      }),
    );
  });

  it("uses token scope for report generation", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-05T00:00:00.000Z"));

    prismaMock.external_access_tokens.findFirst.mockResolvedValue({
      id: "token-4",
      clinic_id: "clinic-1",
      client_id: "client-1",
      report_type: "AER_JSON",
      period_start: new Date("2026-01-01T00:00:00.000Z"),
      period_end: new Date("2026-01-31T00:00:00.000Z"),
      program: null,
      expires_at: new Date("2026-02-10T00:00:00.000Z"),
      revoked_at: null,
    });

    aerReportMock.generateAerReport.mockResolvedValue({
      meta: { report_type: "AER" },
      audit_integrity: { report_id: "report-2" },
    });

    await service.getAerJsonFromToken("scoped-token", { path: "/api/v1/external/aer.json" });

    const call = aerReportMock.generateAerReport.mock.calls[0];
    expect(call[0]).toBe("clinic-1");
    expect(call[1]).toBe("client-1");

    jest.useRealTimers();
  });

  it("caps ttl to 7 days", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-04T00:00:00.000Z"));

    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });

    const expectedExpiresAt = new Date("2026-02-11T00:00:00.000Z");
    prismaMock.external_access_tokens.create.mockResolvedValue({
      id: "token-5",
      report_type: "AER_PDF",
      expires_at: expectedExpiresAt,
    });

    await service.createAerToken({
      userId: "user-1",
      role: "CLINIC_ADMIN" as any,
      clinicId: "clinic-1",
      clientId: "client-1",
      start: "2026-01-01",
      end: "2026-01-31",
      program: null,
      format: "pdf",
      ttlMinutes: 20000,
    });

    const createData = prismaMock.external_access_tokens.create.mock.calls[0][0].data;
    expect(createData.expires_at.toISOString()).toBe(expectedExpiresAt.toISOString());

    jest.useRealTimers();
  });

  it("defaults ttl to 60 minutes when omitted", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-04T08:00:00.000Z"));

    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });

    const expectedExpiresAt = new Date("2026-02-04T09:00:00.000Z");
    prismaMock.external_access_tokens.create.mockResolvedValue({
      id: "token-6",
      report_type: "AER_JSON",
      expires_at: expectedExpiresAt,
    });

    await service.createAerToken({
      userId: "user-1",
      role: "CLINIC_ADMIN" as any,
      clinicId: "clinic-1",
      clientId: "client-1",
      start: "2026-01-01",
      end: "2026-01-31",
      program: null,
      format: "json",
    });

    const createData = prismaMock.external_access_tokens.create.mock.calls[0][0].data;
    expect(createData.expires_at.toISOString()).toBe(expectedExpiresAt.toISOString());

    jest.useRealTimers();
  });
});
