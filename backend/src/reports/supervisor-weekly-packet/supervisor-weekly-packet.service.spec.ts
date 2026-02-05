import { ForbiddenException } from "@nestjs/common";
import { SupervisorEscalationReason, UserRole } from "@prisma/client";
import { SupervisorWeeklyPacketService } from "./supervisor-weekly-packet.service";

const rollupMock = {
  ensureClinicAccess: jest.fn(),
  generateRollup: jest.fn(),
};

const externalAccessMock = {
  createAerToken: jest.fn(),
};

const prismaMock = {
  supervisor_escalations: { findMany: jest.fn() },
};

const buildRow = (overrides: Partial<any>) => ({
  client_id: "client",
  display_id: null,
  assigned: 1,
  completed: 0,
  partial: 0,
  missed: 0,
  late: 0,
  completion_rate: 0,
  last_activity_at: null,
  risk_flag: "ok",
  ...overrides,
});

describe("SupervisorWeeklyPacketService", () => {
  let service: SupervisorWeeklyPacketService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupervisorWeeklyPacketService(
      rollupMock as any,
      externalAccessMock as any,
      prismaMock as any,
    );
  });

  it("orders top risk clients deterministically and omits external links when disabled", async () => {
    rollupMock.generateRollup.mockResolvedValue({
      meta: {
        report_type: "AER_ROLLUP",
        version: "v1",
        generated_at: "2026-02-04T00:00:00.000Z",
        period: { start: "2026-01-01", end: "2026-01-07" },
        clinic_id: "clinic-1",
        program: null,
      },
      summary: {
        clients_in_scope: 5,
        interventions_assigned: 5,
        completed: 0,
        partial: 0,
        missed: 0,
        late: 0,
        completion_rate: 0,
        noncompliance_rate: 0,
      },
      client_rows: [
        buildRow({ client_id: "c", risk_flag: "high", completion_rate: 0.8, missed: 1 }),
        buildRow({ client_id: "b", risk_flag: "high", completion_rate: 0.4, missed: 0 }),
        buildRow({ client_id: "a", risk_flag: "high", completion_rate: 0.4, missed: 2 }),
        buildRow({ client_id: "d", risk_flag: "watch", completion_rate: 0.3, missed: 1 }),
        buildRow({ client_id: "e", risk_flag: "ok", completion_rate: 0.1, missed: 0 }),
      ],
      not_available: [],
    });
    prismaMock.supervisor_escalations.findMany.mockResolvedValue([]);

    const result = await service.generatePacket({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      clinicId: "clinic-1",
      startLabel: "2026-01-01",
      endLabel: "2026-01-07",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-01-07T23:59:59.999Z"),
      program: null,
      top: 3,
      includeExternalLinks: false,
      externalTtlMinutes: 60,
    });

    expect(result.top_risk_clients.map((row) => row.client_id)).toEqual(["a", "b", "c"]);
    expect(result.top_risk_clients[0].external_links).toBeNull();
    expect(result.top_risk_clients[0].internal_links.aer_json).toBe(
      "/api/v1/reports/aer/clinic-1/a?start=2026-01-01&end=2026-01-07",
    );
    expect(result.escalations.open_count).toBe(0);
    expect(result.escalations.rows).toHaveLength(0);
    expect(result.top_risk_clients[0].escalation.status).toBe("NONE");
  });

  it("generates external links with capped TTL", async () => {
    rollupMock.generateRollup.mockResolvedValue({
      meta: {
        report_type: "AER_ROLLUP",
        version: "v1",
        generated_at: "2026-02-04T00:00:00.000Z",
        period: { start: "2026-01-01", end: "2026-01-07" },
        clinic_id: "clinic-1",
        program: null,
      },
      summary: {
        clients_in_scope: 2,
        interventions_assigned: 2,
        completed: 0,
        partial: 0,
        missed: 0,
        late: 0,
        completion_rate: 0,
        noncompliance_rate: 0,
      },
      client_rows: [
        buildRow({ client_id: "x", risk_flag: "high", completion_rate: 0.2, missed: 2 }),
        buildRow({ client_id: "y", risk_flag: "watch", completion_rate: 0.4, missed: 1 }),
      ],
      not_available: [],
    });
    prismaMock.supervisor_escalations.findMany.mockResolvedValue([]);

    externalAccessMock.createAerToken.mockImplementation(async (params: any) => ({
      url: `/api/v1/external/aer.${params.format}?token=token-${params.clientId}-${params.format}`,
    }));

    const result = await service.generatePacket({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      clinicId: "clinic-1",
      startLabel: "2026-01-01",
      endLabel: "2026-01-07",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-01-07T23:59:59.999Z"),
      program: null,
      top: 2,
      includeExternalLinks: true,
      externalTtlMinutes: 2000,
    });

    expect(result.top_risk_clients[0].external_links?.aer_json).toBe(
      "/api/v1/external/aer.json?token=token-x-json",
    );
    expect(externalAccessMock.createAerToken).toHaveBeenCalledTimes(4);
    const ttlValues = externalAccessMock.createAerToken.mock.calls.map(
      (call: any[]) => call[0].ttlMinutes,
    );
    expect(new Set(ttlValues)).toEqual(new Set([1440]));
  });

  it("blocks external link generation for non-admin roles", async () => {
    rollupMock.generateRollup.mockResolvedValue({
      meta: {
        report_type: "AER_ROLLUP",
        version: "v1",
        generated_at: "2026-02-04T00:00:00.000Z",
        period: { start: "2026-01-01", end: "2026-01-07" },
        clinic_id: "clinic-1",
        program: null,
      },
      summary: {
        clients_in_scope: 0,
        interventions_assigned: 0,
        completed: 0,
        partial: 0,
        missed: 0,
        late: 0,
        completion_rate: 0,
        noncompliance_rate: 0,
      },
      client_rows: [],
      not_available: [],
    });
    prismaMock.supervisor_escalations.findMany.mockResolvedValue([]);

    await expect(
      service.generatePacket({
        userId: "user-1",
        role: UserRole.therapist,
        clinicId: "clinic-1",
        startLabel: "2026-01-01",
        endLabel: "2026-01-07",
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-01-07T23:59:59.999Z"),
        program: null,
        top: 10,
        includeExternalLinks: true,
        externalTtlMinutes: 60,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("overlays escalations and flags overdue", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-04T12:00:00.000Z"));

    rollupMock.generateRollup.mockResolvedValue({
      meta: {
        report_type: "AER_ROLLUP",
        version: "v1",
        generated_at: "2026-02-04T00:00:00.000Z",
        period: { start: "2026-01-01", end: "2026-01-07" },
        clinic_id: "clinic-1",
        program: null,
      },
      summary: {
        clients_in_scope: 2,
        interventions_assigned: 2,
        completed: 0,
        partial: 0,
        missed: 0,
        late: 0,
        completion_rate: 0,
        noncompliance_rate: 0,
      },
      client_rows: [
        buildRow({ client_id: "client-1", risk_flag: "high", completion_rate: 0.2, missed: 2 }),
        buildRow({ client_id: "client-2", risk_flag: "watch", completion_rate: 0.4, missed: 1 }),
      ],
      not_available: [],
    });

    prismaMock.supervisor_escalations.findMany.mockResolvedValue([
      {
        id: "esc-open-overdue",
        clinic_id: "clinic-1",
        client_id: "client-1",
        reason: SupervisorEscalationReason.NO_ACTIVITY,
        status: "OPEN",
        period_start: new Date("2026-01-01T00:00:00.000Z"),
        period_end: new Date("2026-01-07T00:00:00.000Z"),
        created_at: new Date("2026-02-01T11:59:23.400Z"), // 72.01h ago
        resolved_at: null,
      },
      {
        id: "esc-resolved",
        clinic_id: "clinic-1",
        client_id: "client-2",
        reason: SupervisorEscalationReason.LOW_COMPLETION,
        status: "RESOLVED",
        period_start: new Date("2026-01-01T00:00:00.000Z"),
        period_end: new Date("2026-01-07T00:00:00.000Z"),
        created_at: new Date("2026-02-03T12:00:00.000Z"),
        resolved_at: new Date("2026-02-04T00:00:00.000Z"),
      },
    ]);

    const result = await service.generatePacket({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      clinicId: "clinic-1",
      startLabel: "2026-01-01",
      endLabel: "2026-01-07",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-01-07T23:59:59.999Z"),
      program: null,
      top: 2,
      includeExternalLinks: false,
      externalTtlMinutes: 60,
    });

    expect(result.escalations.open_count).toBe(1);
    expect(result.escalations.overdue_count).toBe(1);
    expect(result.escalations.rows[0].escalation_id).toBe("esc-open-overdue");
    expect(result.escalations.rows[0].sla.overdue).toBe(true);
    expect(result.top_risk_clients[0].escalation.status).toBe("OPEN");
    expect(result.top_risk_clients[0].escalation.overdue).toBe(true);
    expect(result.top_risk_clients[1].escalation.status).toBe("RESOLVED");

    jest.useRealTimers();
  });

  it("orders escalation rows deterministically", async () => {
    rollupMock.generateRollup.mockResolvedValue({
      meta: {
        report_type: "AER_ROLLUP",
        version: "v1",
        generated_at: "2026-02-04T00:00:00.000Z",
        period: { start: "2026-01-01", end: "2026-01-07" },
        clinic_id: "clinic-1",
        program: null,
      },
      summary: {
        clients_in_scope: 1,
        interventions_assigned: 1,
        completed: 0,
        partial: 0,
        missed: 0,
        late: 0,
        completion_rate: 0,
        noncompliance_rate: 0,
      },
      client_rows: [buildRow({ client_id: "client-1" })],
      not_available: [],
    });

    prismaMock.supervisor_escalations.findMany.mockResolvedValue([
      {
        id: "esc-b",
        clinic_id: "clinic-1",
        client_id: "client-1",
        reason: SupervisorEscalationReason.NO_ACTIVITY,
        status: "OPEN",
        period_start: new Date("2026-01-01T00:00:00.000Z"),
        period_end: new Date("2026-01-07T00:00:00.000Z"),
        created_at: new Date("2026-02-02T12:00:00.000Z"),
        resolved_at: null,
      },
      {
        id: "esc-a",
        clinic_id: "clinic-1",
        client_id: "client-1",
        reason: SupervisorEscalationReason.NO_ACTIVITY,
        status: "OPEN",
        period_start: new Date("2026-01-01T00:00:00.000Z"),
        period_end: new Date("2026-01-07T00:00:00.000Z"),
        created_at: new Date("2026-02-02T12:00:00.000Z"),
        resolved_at: null,
      },
    ]);

    const result = await service.generatePacket({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      clinicId: "clinic-1",
      startLabel: "2026-01-01",
      endLabel: "2026-01-07",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-01-07T23:59:59.999Z"),
      program: null,
      top: 1,
      includeExternalLinks: false,
      externalTtlMinutes: 60,
    });

    expect(result.escalations.rows.map((row) => row.escalation_id)).toEqual([
      "esc-a",
      "esc-b",
    ]);
  });
});
