import { AerRollupService } from "./aer-rollup.service";

const prismaMock = {
  clinic_memberships: { findFirst: jest.fn() },
  clinics: { findUnique: jest.fn() },
  clients: { findMany: jest.fn() },
  assignments: { findMany: jest.fn() },
  responses: { findMany: jest.fn() },
  checkins: { findMany: jest.fn() },
};

describe("AerRollupService", () => {
  let service: AerRollupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AerRollupService(prismaMock as any);
  });

  it("computes rollup rates and deterministic risk ordering", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clients.findMany.mockResolvedValue([
      { id: "client-high", user_id: "user-high" },
      { id: "client-watch", user_id: "user-watch" },
      { id: "client-ok", user_id: "user-ok" },
    ]);
    prismaMock.assignments.findMany.mockResolvedValue([
      {
        id: "h1",
        client_id: "client-high",
        created_at: new Date("2026-01-10T00:00:00.000Z"),
        published_at: new Date("2026-01-10T00:00:00.000Z"),
        due_date: new Date("2026-01-11T00:00:00.000Z"),
      },
      {
        id: "h2",
        client_id: "client-high",
        created_at: new Date("2026-01-10T00:00:00.000Z"),
        published_at: new Date("2026-01-10T00:00:00.000Z"),
        due_date: new Date("2026-01-12T00:00:00.000Z"),
      },
      {
        id: "w1",
        client_id: "client-watch",
        created_at: new Date("2026-01-10T00:00:00.000Z"),
        published_at: new Date("2026-01-10T00:00:00.000Z"),
        due_date: new Date("2026-01-11T00:00:00.000Z"),
      },
      {
        id: "w2",
        client_id: "client-watch",
        created_at: new Date("2026-01-10T00:00:00.000Z"),
        published_at: new Date("2026-01-10T00:00:00.000Z"),
        due_date: new Date("2026-01-12T00:00:00.000Z"),
      },
    ]);
    prismaMock.responses.findMany.mockResolvedValue([
      {
        id: "r1",
        client_id: "client-watch",
        assignment_id: "w1",
        created_at: new Date("2026-01-10T12:00:00.000Z"),
      },
    ]);
    prismaMock.checkins.findMany.mockResolvedValue([
      { client_id: "client-ok", created_at: new Date("2026-01-10T05:00:00.000Z") },
    ]);

    const report = await service.generateRollup({
      clinicId: "clinic-1",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-02-01T23:59:59.999Z"),
      program: null,
      limit: 100,
      cursor: null,
    });

    expect(report.summary.clients_in_scope).toBe(3);
    expect(report.summary.interventions_assigned).toBe(4);
    expect(report.summary.completed).toBe(1);
    expect(report.summary.missed).toBe(3);
    expect(report.summary.completion_rate).toBe(0.25);
    expect(report.summary.noncompliance_rate).toBe(0.75);

    expect(report.client_rows[0].client_id).toBe("client-high");
    expect(report.client_rows[0].risk_flag).toBe("high");
    expect(report.client_rows[1].client_id).toBe("client-watch");
    expect(report.client_rows[1].risk_flag).toBe("watch");
    expect(report.client_rows[2].client_id).toBe("client-ok");
    expect(report.client_rows[2].risk_flag).toBe("ok");

    expect(report.not_available).toContain(
      "risk_flag (insufficient data: no assigned interventions)",
    );
  });
});
