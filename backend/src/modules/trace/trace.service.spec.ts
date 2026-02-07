import { UserRole } from "@prisma/client";
import { TraceService } from "./trace.service";

const prismaMock = {
  clients: { findUnique: jest.fn() },
  clinic_memberships: { findFirst: jest.fn() },
  therapists: { findFirst: jest.fn() },
  assignments: { findMany: jest.fn() },
  responses: { findMany: jest.fn() },
};

describe("TraceService", () => {
  let service: TraceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TraceService(prismaMock as any);
  });

  it("blocks therapists who do not own the client", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist_id: "therapist-1",
      therapist: { id: "therapist-1", clinic_id: "clinic-1", user_id: "user-2" },
    });
    prismaMock.therapists.findFirst.mockResolvedValue({
      id: "therapist-2",
      clinic_id: "clinic-1",
    });

    await expect(
      service.getClientTrace({
        userId: "user-1",
        role: UserRole.therapist,
        clientId: "client-1",
        start: "2026-01-01",
        end: "2026-01-31",
      }),
    ).rejects.toThrow("Client does not belong to this therapist");
  });

  it("orders needs-review first, then due date, then assignment id", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist_id: "therapist-1",
      therapist: { id: "therapist-1", clinic_id: "clinic-1", user_id: "user-2" },
    });

    prismaMock.assignments.findMany.mockResolvedValue([
      {
        id: "a1",
        title: "Assignment 1",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
        published_at: new Date("2026-01-02T00:00:00.000Z"),
        due_date: new Date("2026-01-03T00:00:00.000Z"),
        library_item_id: "lib-1",
        library_item_version_id: "ver-1",
        library_item_version: 1,
        library_source_title: "Library",
        library_source_slug: "library",
        library_assigned_title: "Library",
        library_assigned_slug: "library",
        library_assigned_version_number: 1,
        prompt: { title: null },
      },
      {
        id: "a2",
        title: "Assignment 2",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
        published_at: new Date("2026-01-02T00:00:00.000Z"),
        due_date: new Date("2026-01-02T00:00:00.000Z"),
        library_item_id: null,
        library_item_version_id: null,
        library_item_version: null,
        library_source_title: null,
        library_source_slug: null,
        library_assigned_title: null,
        library_assigned_slug: null,
        library_assigned_version_number: null,
        prompt: { title: "Prompt" },
      },
      {
        id: "a3",
        title: "Assignment 3",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
        published_at: new Date("2026-01-02T00:00:00.000Z"),
        due_date: new Date("2026-01-04T00:00:00.000Z"),
        library_item_id: null,
        library_item_version_id: null,
        library_item_version: null,
        library_source_title: null,
        library_source_slug: null,
        library_assigned_title: null,
        library_assigned_slug: null,
        library_assigned_version_number: null,
        prompt: { title: "Prompt" },
      },
    ]);

    prismaMock.responses.findMany.mockResolvedValue([
      {
        id: "r1",
        assignment_id: "a1",
        created_at: new Date("2026-01-02T08:00:00.000Z"),
        reviewed_at: null,
        reviewed_by: null,
      },
      {
        id: "r2",
        assignment_id: "a2",
        created_at: new Date("2026-01-02T08:00:00.000Z"),
        reviewed_at: new Date("2026-01-03T09:00:00.000Z"),
        reviewed_by: { user_id: "therapist-1", full_name: "Therapist One" },
      },
    ]);

    const result = await service.getClientTrace({
      userId: "admin-1",
      role: UserRole.admin,
      clientId: "client-1",
      start: "2026-01-01",
      end: "2026-01-31",
    });

    expect(result.rows.map((row) => row.assignment_id)).toEqual(["a1", "a2", "a3"]);
    const missing = result.rows.find((row) => row.assignment_id === "a3");
    expect(missing?.aer_included).toBe(false);
    expect(missing?.aer_reason_not_included).toBe("NO_RESPONSE");
  });

  it("applies period filter in assignment query", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist_id: "therapist-1",
      therapist: { id: "therapist-1", clinic_id: "clinic-1", user_id: "user-2" },
    });
    prismaMock.assignments.findMany.mockResolvedValue([]);
    prismaMock.responses.findMany.mockResolvedValue([]);

    await service.getClientTrace({
      userId: "admin-1",
      role: UserRole.admin,
      clientId: "client-1",
      start: "2026-01-01",
      end: "2026-01-31",
    });

    const call = prismaMock.assignments.findMany.mock.calls[0][0];
    expect(call.where?.OR).toBeDefined();
  });

  it("marks out-of-period responses as not included", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist_id: "therapist-1",
      therapist: { id: "therapist-1", clinic_id: "clinic-1", user_id: "user-2" },
    });

    prismaMock.assignments.findMany.mockResolvedValue([
      {
        id: "a1",
        title: "Assignment 1",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
        published_at: new Date("2026-01-02T00:00:00.000Z"),
        due_date: new Date("2026-01-05T00:00:00.000Z"),
        library_item_id: null,
        library_item_version_id: null,
        library_item_version: null,
        library_source_title: null,
        library_source_slug: null,
        library_assigned_title: null,
        library_assigned_slug: null,
        library_assigned_version_number: null,
        prompt: { title: "Prompt" },
      },
    ]);

    prismaMock.responses.findMany.mockResolvedValue([
      {
        id: "r1",
        assignment_id: "a1",
        created_at: new Date("2025-12-15T10:00:00.000Z"),
        reviewed_at: null,
        reviewed_by: null,
      },
    ]);

    const result = await service.getClientTrace({
      userId: "admin-1",
      role: UserRole.admin,
      clientId: "client-1",
      start: "2026-01-01",
      end: "2026-01-31",
    });

    expect(result.rows[0]?.aer_included).toBe(false);
    expect(result.rows[0]?.aer_reason_not_included).toBe("OUT_OF_PERIOD");
  });
});
