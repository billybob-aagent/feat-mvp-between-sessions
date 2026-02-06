import { AerReportService } from "./aer-report.service";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const prismaMock = {
  clinic_memberships: { findFirst: jest.fn() },
  clinics: { findUnique: jest.fn() },
  clients: { findUnique: jest.fn() },
  assignments: { findMany: jest.fn() },
  responses: { findMany: jest.fn(), findFirst: jest.fn() },
  feedback: { findMany: jest.fn() },
  checkins: { findMany: jest.fn() },
  notifications: { findMany: jest.fn() },
};

describe("AerReportService", () => {
  let service: AerReportService;

  const schemaPath = path.resolve(
    __dirname,
    "../../../../docs/aer/AER_STANDARD_V1.schema.json",
  );
  const schemaSha = crypto
    .createHash("sha256")
    .update(fs.readFileSync(schemaPath))
    .digest("hex");

  const seedMocks = () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ name: "Clinic One" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      user_id: "user-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.assignments.findMany.mockResolvedValue([
      {
        id: "a1",
        title: "Assignment 1",
        created_at: new Date("2026-01-02T10:00:00.000Z"),
        published_at: new Date("2026-01-02T10:00:00.000Z"),
        due_date: new Date("2026-01-10T00:00:00.000Z"),
        library_item_id: "lib-1",
        library_item_version_id: "ver-1",
        library_item_version: 3,
        library_source_title: "Library Item",
        library_source_slug: "library-item",
        library_source_content_type: "Therapeutic",
        therapist: { user_id: "therapist-1", full_name: "Therapist One" },
        prompt: { title: "Prompt 1" },
      },
      {
        id: "a2",
        title: "Assignment 2",
        created_at: new Date("2026-01-03T10:00:00.000Z"),
        published_at: new Date("2026-01-03T10:00:00.000Z"),
        due_date: new Date("2026-01-20T00:00:00.000Z"),
        library_item_id: null,
        library_item_version_id: null,
        library_item_version: null,
        library_source_title: null,
        library_source_slug: null,
        library_source_content_type: null,
        therapist: { user_id: "therapist-1", full_name: "Therapist One" },
        prompt: null,
      },
    ]);
    prismaMock.responses.findMany.mockResolvedValue([
      {
        id: "r1",
        assignment_id: "a1",
        created_at: new Date("2026-01-09T09:00:00.000Z"),
        mood: 5,
        reviewed_at: null,
        reviewed_by: null,
        flagged_at: null,
        starred_at: null,
      },
      {
        id: "r2",
        assignment_id: "a2",
        created_at: new Date("2026-01-25T09:00:00.000Z"),
        mood: 7,
        reviewed_at: new Date("2026-01-26T10:00:00.000Z"),
        reviewed_by: { user_id: "therapist-1", full_name: "Therapist One" },
        flagged_at: null,
        starred_at: null,
      },
    ]);
    prismaMock.feedback.findMany.mockResolvedValue([
      {
        response_id: "r1",
        created_at: new Date("2026-01-12T10:00:00.000Z"),
        therapist: { user_id: "therapist-1", full_name: "Therapist One" },
        response: { assignment_id: "a1" },
      },
    ]);
    prismaMock.checkins.findMany.mockResolvedValue([
      { id: "chk-1", created_at: new Date("2026-01-05T08:00:00.000Z"), mood: 6 },
    ]);
    prismaMock.notifications.findMany.mockResolvedValue([
      {
        type: "assignment_due_24h",
        dedupe_key: "assignment:a1:reminder:24h",
        created_at: new Date("2026-01-09T00:00:00.000Z"),
      },
    ]);
    prismaMock.responses.findFirst.mockResolvedValue({
      reviewed_at: new Date("2026-01-26T10:00:00.000Z"),
      reviewed_by: { user_id: "therapist-1", full_name: "Therapist One" },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AerReportService(prismaMock as any);
  });

  it("builds a deterministic report with ordered timeline", async () => {
    seedMocks();

    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-01-31T23:59:59.999Z");

    const report = await service.generateAerReport(
      "clinic-1",
      "client-1",
      start,
      end,
      undefined,
      {
        periodStartLabel: "2026-01-01",
        periodEndLabel: "2026-01-31",
        generatedAtOverride: new Date("2026-02-01T00:00:00.000Z"),
      },
    );

    expect(report.meta.report_type).toBe("AER");
    expect(report.audit_integrity.report_id).toBe(
      "AER-v1:clinic-1:client-1:2026-01-01:2026-01-31",
    );

    const assignmentOne = report.prescribed_interventions.find(
      (entry) => entry.assignment_id === "a1",
    );
    const assignmentTwo = report.prescribed_interventions.find(
      (entry) => entry.assignment_id === "a2",
    );

    expect(assignmentOne?.status_summary.completed).toBe(1);
    expect(assignmentOne?.status_summary.late).toBe(0);
    expect(assignmentOne?.completed_at).toBe("2026-01-09T09:00:00.000Z");
    expect(assignmentOne?.library_source?.item_id).toBe("lib-1");
    expect(assignmentOne?.library_source?.version_id).toBe("ver-1");
    expect(assignmentOne?.library_source?.version).toBe(3);
    expect(assignmentOne?.evidence_refs).toEqual(["r1"]);
    expect(assignmentTwo?.status_summary.completed).toBe(1);
    expect(assignmentTwo?.status_summary.late).toBe(1);
    expect(assignmentTwo?.reviewed_at).toBe("2026-01-26T10:00:00.000Z");
    expect(assignmentTwo?.reviewed_by?.user_id).toBe("therapist-1");

    const timeline = report.adherence_timeline.map((entry) =>
      new Date(entry.ts).getTime(),
    );
    const sorted = [...timeline].sort((a, b) => a - b);
    expect(timeline).toEqual(sorted);

    expect(report.noncompliance_escalations).toHaveLength(1);
    expect(report.noncompliance_escalations[0].type).toBe("reminder");
  });

  it("returns identical report outputs for identical inputs", async () => {
    seedMocks();

    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-01-31T23:59:59.999Z");

    const first = await service.generateAerReport(
      "clinic-1",
      "client-1",
      start,
      end,
      undefined,
      {
        periodStartLabel: "2026-01-01",
        periodEndLabel: "2026-01-31",
        generatedAtOverride: new Date("2026-02-01T00:00:00.000Z"),
      },
    );

    const second = await service.generateAerReport(
      "clinic-1",
      "client-1",
      start,
      end,
      undefined,
      {
        periodStartLabel: "2026-01-01",
        periodEndLabel: "2026-01-31",
        generatedAtOverride: new Date("2026-02-01T00:00:00.000Z"),
      },
    );

    expect(first).toEqual(second);
  });

  it("includes verification metadata with schema hash", async () => {
    seedMocks();

    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-01-31T23:59:59.999Z");

    const report = await service.generateAerReport(
      "clinic-1",
      "client-1",
      start,
      end,
      undefined,
      {
        periodStartLabel: "2026-01-01",
        periodEndLabel: "2026-01-31",
        generatedAtOverride: new Date("2026-02-01T00:00:00.000Z"),
      },
    );

    expect(report.meta.verification.standard).toBe("AER_STANDARD_V1");
    expect(report.meta.verification.standard_version).toBe("1.1");
    expect(report.meta.verification.schema_version).toBe("AER_STANDARD_V1");
    expect(report.meta.verification.schema_sha256).toBe(schemaSha);
    expect(report.meta.verification.generator_commit).toBe(
      process.env.GIT_SHA?.trim() || "dev",
    );
    expect(report.meta.verification.verification_tool_version).toBe("verify_aer@1.1");
  });
});
