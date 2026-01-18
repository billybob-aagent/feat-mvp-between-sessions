import { ForbiddenException } from "@nestjs/common";
import { LibraryService } from "./library.service";
import { UserRole } from "@prisma/client";

const prismaMock = {
  clinic_memberships: { findFirst: jest.fn() },
  therapists: { findUnique: jest.fn() },
  clients: { findUnique: jest.fn() },
  library_chunks: { findMany: jest.fn() },
  form_signature_requests: { findFirst: jest.fn(), update: jest.fn() },
};

const auditMock = { log: jest.fn() };

describe("LibraryService RBAC", () => {
  let service: LibraryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LibraryService(prismaMock as any, auditMock as any);
  });

  it("filters search results for client role", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.library_chunks.findMany.mockResolvedValue([]);

    await service.search("user-1", UserRole.client, "query", 5, null);

    const args = prismaMock.library_chunks.findMany.mock.calls[0][0];
    expect(args.where.item.status).toBe("PUBLISHED");
  });

  it("blocks client signing another client request", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.form_signature_requests.findFirst.mockResolvedValue({
      id: "req-1",
      clinic_id: "clinic-1",
      status: "pending",
      client_id: "client-2",
      clinician_id: null,
      requested_at: new Date(),
      item: { title: "Form", content_type: "Form", sections: [], version: 1 },
    });

    await expect(
      service.signRequest("user-1", UserRole.client, "req-1", {
        signerName: "Client",
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
