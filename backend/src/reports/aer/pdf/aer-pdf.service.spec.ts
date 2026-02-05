import { AerPdfService } from "./aer-pdf.service";

const buildReport = (overrides: Partial<any> = {}) => ({
  meta: {
    report_type: "AER",
    version: "v1",
    generated_at: "2026-02-04T23:59:59.999Z",
    period: { start: "2026-01-01", end: "2026-02-04" },
    clinic_id: "clinic-1",
    client_id: "client-1",
    program: null,
    generated_by: { type: "system", id: "backend" },
  },
  context: {
    clinic: { name: "Clinic One" },
    client: { display_id: null },
  },
  prescribed_interventions: [
    {
      assignment_id: "a1",
      title: "Assignment One",
      assigned_by: { user_id: "u1", name: "Therapist" },
      assigned_at: "2026-01-02T10:00:00.000Z",
      due: { start: "2026-01-02T10:00:00.000Z", end: "2026-01-10T00:00:00.000Z" },
      completion_criteria: null,
      status_summary: { completed: 1, partial: 0, missed: 0, late: 0 },
    },
  ],
  adherence_timeline: [
    {
      ts: "2026-01-09T09:00:00.000Z",
      type: "assignment_completed",
      source: "client",
      ref: { assignment_id: "a1", response_id: "r1" },
      details: {},
    },
  ],
  noncompliance_escalations: [
    {
      ts: "2026-01-09T00:00:00.000Z",
      type: "reminder",
      channel: "unknown",
      details: {},
    },
  ],
  clinician_review: {
    reviewed: false,
    reviewed_at: null,
    reviewed_by: { user_id: null, name: null },
    notes: null,
  },
  audit_integrity: {
    data_sources: ["prisma"],
    notes: "report notes",
    report_id: "AER-v1:clinic-1:client-1:2026-01-01:2026-02-04",
    hash: null,
  },
  not_available: [],
  ...overrides,
});

describe("AerPdfService", () => {
  it("produces identical PDF buffers for identical report inputs", async () => {
    const aerReportService = {
      generateAerReport: jest.fn().mockResolvedValue(buildReport()),
    };
    const service = new AerPdfService(aerReportService as any);

    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-02-04T23:59:59.999Z");

    const first = await service.generatePdfReport("clinic-1", "client-1", start, end);
    const second = await service.generatePdfReport("clinic-1", "client-1", start, end);

    expect(first.buffer.equals(second.buffer)).toBe(true);
    expect(first.buffer.length).toBeGreaterThan(100);
  });

  it("renders even when optional sections are empty", async () => {
    const aerReportService = {
      generateAerReport: jest.fn().mockResolvedValue(
        buildReport({
          prescribed_interventions: [],
          adherence_timeline: [],
          noncompliance_escalations: [],
          clinician_review: {
            reviewed: false,
            reviewed_at: null,
            reviewed_by: { user_id: null, name: null },
            notes: null,
          },
        }),
      ),
    };

    const service = new AerPdfService(aerReportService as any);
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-02-04T23:59:59.999Z");

    const result = await service.generatePdfReport("clinic-1", "client-1", start, end);
    expect(result.buffer.length).toBeGreaterThan(50);
  });
});
