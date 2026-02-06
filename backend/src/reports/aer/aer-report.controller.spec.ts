import { AerReportController } from "./aer-report.controller";

const reportFixture = {
  meta: {
    report_type: "AER",
    period: { start: "2026-01-01", end: "2026-01-31" },
    verification: {
      standard: "AER_STANDARD_V1",
      standard_version: "1.1",
      schema_version: "AER_STANDARD_V1",
      schema_sha256: "deadbeef",
      generator_commit: "dev",
      verification_tool_version: "verify_aer@1.1",
    },
  },
  context: { clinic: { name: "Clinic" }, client: { display_id: null } },
  prescribed_interventions: [],
  adherence_timeline: [],
  noncompliance_escalations: [],
  clinician_review: {
    reviewed: false,
    reviewed_at: null,
    reviewed_by: { user_id: null, name: null },
    notes: null,
  },
  audit_integrity: {
    data_sources: ["prisma"],
    report_id: "AER-v1:clinic-1:client-1:2026-01-01:2026-01-31",
    hash: null,
    notes: null,
  },
  not_available: [],
};

describe("AerReportController", () => {
  it("returns deterministic output even if audit logging fails", async () => {
    const aerReport = {
      ensureClinicAccess: jest.fn().mockResolvedValue(undefined),
      generateAerReport: jest.fn().mockResolvedValue(reportFixture),
    };
    const audit = {
      log: jest.fn().mockRejectedValue(new Error("audit down")),
    };

    const controller = new AerReportController(aerReport as any, audit as any);
    const req = {
      user: { userId: "user-1", role: "admin" },
      ip: "127.0.0.1",
      headers: { "user-agent": "jest" },
    } as any;

    const first = await controller.generate(
      req,
      "clinic-1",
      "client-1",
      "2026-01-01",
      "2026-01-31",
      undefined,
    );
    const second = await controller.generate(
      req,
      "clinic-1",
      "client-1",
      "2026-01-01",
      "2026-01-31",
      undefined,
    );

    expect(first).toEqual(reportFixture);
    expect(second).toEqual(reportFixture);
    expect(first).toEqual(second);
    expect(audit.log).toHaveBeenCalled();
  });
});
