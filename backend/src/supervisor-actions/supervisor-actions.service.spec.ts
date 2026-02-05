import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { SupervisorEscalationReason, UserRole } from "@prisma/client";
import { SupervisorActionsService } from "./supervisor-actions.service";

const prismaMock = {
  clinic_memberships: { findFirst: jest.fn() },
  clinics: { findUnique: jest.fn() },
  clients: { findUnique: jest.fn() },
  therapists: { findUnique: jest.fn() },
  supervisor_escalations: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const auditMock = {
  log: jest.fn(),
};

describe("SupervisorActionsService", () => {
  let service: SupervisorActionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupervisorActionsService(prismaMock as any, auditMock as any);
  });

  it("blocks non-admin roles", async () => {
    await expect(
      service.createEscalation({
        userId: "user-1",
        role: UserRole.therapist,
        clinicId: "clinic-1",
        clientId: "client-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-07",
        reason: SupervisorEscalationReason.NO_ACTIVITY,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates an escalation with date-only fields and audits", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.supervisor_escalations.create.mockResolvedValue({
      id: "esc-1",
      created_at: new Date("2026-02-04T00:00:00.000Z"),
    });

    const result = await service.createEscalation({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      clinicId: "clinic-1",
      clientId: "client-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-07",
      reason: SupervisorEscalationReason.MISSED_INTERVENTIONS,
      note: "Follow up",
    });

    expect(result.ok).toBe(true);
    expect(result.escalationId).toBe("esc-1");
    expect(result.createdAt).toBe("2026-02-04T00:00:00.000Z");

    const createData = prismaMock.supervisor_escalations.create.mock.calls[0][0].data;
    expect(createData.period_start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(createData.period_end.toISOString()).toBe("2026-01-07T00:00:00.000Z");

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SUPERVISOR_ESCALATION_CREATED",
        entityType: "supervisor_escalation",
        entityId: "esc-1",
      }),
    );
  });

  it("rejects invalid date format", async () => {
    await expect(
      service.createEscalation({
        userId: "user-1",
        role: UserRole.CLINIC_ADMIN,
        clinicId: "clinic-1",
        clientId: "client-1",
        periodStart: "2026-1-01",
        periodEnd: "2026-01-07",
        reason: SupervisorEscalationReason.OTHER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects periodStart after periodEnd", async () => {
    await expect(
      service.createEscalation({
        userId: "user-1",
        role: UserRole.CLINIC_ADMIN,
        clinicId: "clinic-1",
        clientId: "client-1",
        periodStart: "2026-02-01",
        periodEnd: "2026-01-01",
        reason: SupervisorEscalationReason.LOW_COMPLETION,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects missing assigned therapist", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.therapists.findUnique.mockResolvedValue(null);

    await expect(
      service.createEscalation({
        userId: "user-1",
        role: UserRole.CLINIC_ADMIN,
        clinicId: "clinic-1",
        clientId: "client-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-07",
        reason: SupervisorEscalationReason.NO_ACTIVITY,
        assignToTherapistId: "therapist-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("resolves an open escalation and audits", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.supervisor_escalations.findUnique.mockResolvedValue({
      id: "esc-1",
      clinic_id: "clinic-1",
      client_id: "client-1",
      period_start: new Date("2026-01-01T00:00:00.000Z"),
      period_end: new Date("2026-01-07T00:00:00.000Z"),
      reason: SupervisorEscalationReason.NO_ACTIVITY,
      status: "OPEN",
    });
    prismaMock.supervisor_escalations.update.mockResolvedValue({
      id: "esc-1",
      resolved_at: new Date("2026-02-04T12:00:00.000Z"),
    });

    const result = await service.resolveEscalation({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      clinicId: "clinic-1",
      escalationId: "esc-1",
      note: "Resolved",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("RESOLVED");
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SUPERVISOR_ESCALATION_RESOLVED",
        entityId: "esc-1",
      }),
    );
  });

  it("returns conflict when resolving a resolved escalation", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.supervisor_escalations.findUnique.mockResolvedValue({
      id: "esc-2",
      clinic_id: "clinic-1",
      client_id: "client-1",
      period_start: new Date("2026-01-01T00:00:00.000Z"),
      period_end: new Date("2026-01-07T00:00:00.000Z"),
      reason: SupervisorEscalationReason.NO_ACTIVITY,
      status: "RESOLVED",
    });

    await expect(
      service.resolveEscalation({
        userId: "user-1",
        role: UserRole.CLINIC_ADMIN,
        clinicId: "clinic-1",
        escalationId: "esc-2",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects resolve for clinic mismatch", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.supervisor_escalations.findUnique.mockResolvedValue({
      id: "esc-3",
      clinic_id: "clinic-other",
      client_id: "client-1",
      period_start: new Date("2026-01-01T00:00:00.000Z"),
      period_end: new Date("2026-01-07T00:00:00.000Z"),
      reason: SupervisorEscalationReason.NO_ACTIVITY,
      status: "OPEN",
    });

    await expect(
      service.resolveEscalation({
        userId: "user-1",
        role: UserRole.CLINIC_ADMIN,
        clinicId: "clinic-1",
        escalationId: "esc-3",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("computes SLA fields and overdue thresholds", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-04T12:00:00.000Z"));

    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.supervisor_escalations.findMany.mockResolvedValue([
      {
        id: "esc-open-ok",
        clinic_id: "clinic-1",
        client_id: "client-1",
        assign_to_therapist_id: null,
        reason: SupervisorEscalationReason.NO_ACTIVITY,
        period_start: new Date("2026-01-01T00:00:00.000Z"),
        period_end: new Date("2026-01-07T00:00:00.000Z"),
        status: "OPEN",
        created_at: new Date("2026-02-01T12:00:00.000Z"), // exactly 72h ago
        resolved_at: null,
      },
      {
        id: "esc-open-overdue",
        clinic_id: "clinic-1",
        client_id: "client-2",
        assign_to_therapist_id: null,
        reason: SupervisorEscalationReason.LOW_COMPLETION,
        period_start: new Date("2026-01-01T00:00:00.000Z"),
        period_end: new Date("2026-01-07T00:00:00.000Z"),
        status: "OPEN",
        created_at: new Date("2026-02-01T11:59:23.400Z"), // 72.01h ago
        resolved_at: null,
      },
      {
        id: "esc-resolved",
        clinic_id: "clinic-1",
        client_id: "client-3",
        assign_to_therapist_id: null,
        reason: SupervisorEscalationReason.MISSED_INTERVENTIONS,
        period_start: new Date("2026-01-01T00:00:00.000Z"),
        period_end: new Date("2026-01-07T00:00:00.000Z"),
        status: "RESOLVED",
        created_at: new Date("2026-02-03T12:00:00.000Z"),
        resolved_at: new Date("2026-02-04T00:00:00.000Z"),
      },
    ]);

    const result = await service.listEscalations({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      clinicId: "clinic-1",
      status: "ALL",
      limit: 50,
    });

    const openOk = result.rows.find((row) => row.id === "esc-open-ok");
    const openOverdue = result.rows.find((row) => row.id === "esc-open-overdue");
    const resolved = result.rows.find((row) => row.id === "esc-resolved");

    expect(openOk?.sla.age_hours).toBe(72);
    expect(openOk?.sla.overdue).toBe(false);

    expect(openOverdue?.sla.overdue).toBe(true);

    expect(resolved?.sla.time_to_resolve_hours).toBe(12);
    expect(resolved?.sla.age_hours).toBe(12);

    jest.useRealTimers();
  });

  it("blocks list escalation for non-admin roles", async () => {
    await expect(
      service.listEscalations({
        userId: "user-1",
        role: UserRole.therapist,
        clinicId: "clinic-1",
        status: "OPEN",
        limit: 50,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
