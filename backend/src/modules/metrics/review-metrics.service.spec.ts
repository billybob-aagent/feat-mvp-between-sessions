import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ReviewRevenueMetricsService } from "./review-metrics.service";

const prismaMock = {
  clinics: { findUnique: jest.fn() },
  clinic_memberships: { findFirst: jest.fn() },
  therapists: { findFirst: jest.fn() },
  clients: { findMany: jest.fn() },
  responses: { findMany: jest.fn(), count: jest.fn() },
  assignments: { count: jest.fn() },
  supervisor_escalations: { count: jest.fn(), findMany: jest.fn() },
  audit_logs: { count: jest.fn() },
};

describe("ReviewRevenueMetricsService", () => {
  let service: ReviewRevenueMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewRevenueMetricsService(prismaMock as any);
  });

  it("blocks clinic metrics for non-members", async () => {
    prismaMock.clinics.findUnique.mockResolvedValue({ id: "clinic-1" });
    prismaMock.clinic_memberships.findFirst.mockResolvedValue(null);

    await expect(
      service.getClinicMetrics({
        userId: "user-1",
        role: UserRole.therapist,
        clinicId: "clinic-1",
        start: "2026-02-01",
        end: "2026-02-07",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("scopes therapist metrics to therapist-owned data", async () => {
    prismaMock.therapists.findFirst.mockResolvedValue({ id: "therapist-1", clinic_id: "clinic-1" });
    prismaMock.responses.findMany.mockResolvedValue([]);
    prismaMock.responses.count.mockResolvedValue(0);
    prismaMock.assignments.count.mockResolvedValue(0);
    prismaMock.clients.findMany.mockResolvedValue([{ id: "client-1" }]);
    prismaMock.supervisor_escalations.count.mockResolvedValue(0);
    prismaMock.supervisor_escalations.findMany.mockResolvedValue([]);
    prismaMock.audit_logs.count.mockResolvedValue(0);

    await service.getTherapistMetrics({
      userId: "user-1",
      role: UserRole.therapist,
      clinicId: "clinic-1",
      start: "2026-02-01",
      end: "2026-02-07",
    });

    expect(prismaMock.responses.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignment: { therapist_id: "therapist-1" },
        }),
      }),
    );

    expect(prismaMock.assignments.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ therapist_id: "therapist-1" }),
      }),
    );
  });
});
