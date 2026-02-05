import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service";
import { UserRole } from "@prisma/client";

const prismaMock = {
  clinic_memberships: { findFirst: jest.fn() },
  therapists: { findFirst: jest.fn() },
  clients: { findUnique: jest.fn() },
  library_items: { findFirst: jest.fn() },
  library_item_versions: { findFirst: jest.fn() },
  assignments: { create: jest.fn(), findMany: jest.fn() },
};

const notificationsMock = { notifyUser: jest.fn() };
const auditMock = { log: jest.fn() };

describe("AssignmentsService createFromLibrary", () => {
  let service: AssignmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssignmentsService(prismaMock as any, notificationsMock as any, auditMock as any);
  });

  it("rejects unpublished library item", async () => {
    prismaMock.therapists.findFirst.mockResolvedValue({ id: "t-1", clinic_id: "clinic-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "c-1",
      therapist_id: "t-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.library_items.findFirst.mockResolvedValue(null);

    await expect(
      service.createFromLibrary("u-1", UserRole.therapist, {
        clinicId: "clinic-1",
        clientId: "c-1",
        libraryItemId: "lib-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("enforces client belongs to clinic for clinic admin", async () => {
    prismaMock.clinic_memberships.findFirst.mockResolvedValue({ clinic_id: "clinic-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "c-1",
      therapist_id: "t-1",
      therapist: { clinic_id: "clinic-2" },
    });

    await expect(
      service.createFromLibrary("u-1", UserRole.CLINIC_ADMIN, {
        clinicId: "clinic-1",
        clientId: "c-1",
        libraryItemId: "lib-1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires client-safe sections", async () => {
    prismaMock.therapists.findFirst.mockResolvedValue({ id: "t-1", clinic_id: "clinic-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "c-1",
      therapist_id: "t-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.library_items.findFirst.mockResolvedValue({
      id: "lib-1",
      title: "Item",
      slug: "item",
      content_type: "Therapeutic",
      status: "PUBLISHED",
      version: 3,
    });
    prismaMock.library_item_versions.findFirst.mockResolvedValue({
      id: "v-1",
      version_number: 3,
      sections_snapshot: [{ title: "Clin", text: "secret", audience: "Clinician" }],
    });

    await expect(
      service.createFromLibrary("u-1", UserRole.therapist, {
        clinicId: "clinic-1",
        clientId: "c-1",
        libraryItemId: "lib-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists linkage and uses deterministic title default/override", async () => {
    prismaMock.therapists.findFirst.mockResolvedValue({ id: "t-1", clinic_id: "clinic-1" });
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "c-1",
      therapist_id: "t-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.library_items.findFirst.mockResolvedValue({
      id: "lib-1",
      title: "Library Title",
      slug: "lib-title",
      content_type: "Therapeutic",
      status: "PUBLISHED",
      version: 7,
    });
    prismaMock.library_item_versions.findFirst.mockResolvedValue({
      id: "v-7",
      version_number: 7,
      sections_snapshot: [{ title: "Client", text: "hello", audience: "Client" }],
    });

    prismaMock.assignments.create.mockResolvedValue({
      id: "a-1",
      status: "published",
      published_at: new Date("2026-02-04T00:00:00.000Z"),
      due_date: null,
      created_at: new Date("2026-02-04T00:00:00.000Z"),
      title: "Library Title",
      description: null,
      library_item_id: "lib-1",
      library_item_version_id: "v-7",
      library_item_version: 7,
      library_source_title: "Library Title",
      library_source_slug: "lib-title",
      library_source_content_type: "Therapeutic",
      therapist_id: "t-1",
      client_id: "c-1",
    });

    await service.createFromLibrary("u-1", UserRole.therapist, {
      clinicId: "clinic-1",
      clientId: "c-1",
      libraryItemId: "lib-1",
      assignmentTitleOverride: null,
    });

    const call1 = prismaMock.assignments.create.mock.calls[0][0];
    expect(call1.data.library_item_id).toBe("lib-1");
    expect(call1.data.library_item_version).toBe(7);
    expect(call1.data.library_source_title).toBe("Library Title");
    expect(call1.data.title).toBe("Library Title");

    prismaMock.assignments.create.mockClear();
    await service.createFromLibrary("u-1", UserRole.therapist, {
      clinicId: "clinic-1",
      clientId: "c-1",
      libraryItemId: "lib-1",
      assignmentTitleOverride: "Override Title",
    });

    const call2 = prismaMock.assignments.create.mock.calls[0][0];
    expect(call2.data.title).toBe("Override Title");
  });
});
