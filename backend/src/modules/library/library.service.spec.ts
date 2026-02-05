import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { LibraryService } from "./library.service";
import { UserRole } from "@prisma/client";

const prismaMock = {
  clinic_memberships: { findFirst: jest.fn() },
  therapists: { findUnique: jest.fn() },
  clients: { findUnique: jest.fn() },
  library_chunks: { findMany: jest.fn() },
  library_items: { findFirst: jest.fn(), findMany: jest.fn() },
  form_signature_requests: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
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
    prismaMock.library_items.findMany.mockResolvedValue([]);

    await service.search("user-1", UserRole.client, "query", 5, null);

    expect(prismaMock.library_chunks.findMany).not.toHaveBeenCalled();
    const args = prismaMock.library_items.findMany.mock.calls[0][0];
    expect(args.where.status).toBe("PUBLISHED");
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

  it("filters getItem sections for client audience only", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.library_items.findFirst.mockResolvedValue({
      id: "item-1",
      clinic_id: "clinic-1",
      status: "PUBLISHED",
      collection_id: "col-1",
      slug: "x",
      title: "Item",
      content_type: "Therapeutic",
      metadata: null,
      sections: [
        { title: "Clin", text: "secret", audience: "Clinician" },
        { title: "Client", text: "ok", audience: "Client" },
      ],
      version: 1,
      source_file_name: null,
      import_timestamp: null,
      created_at: new Date(),
      updated_at: new Date(),
      versions: [],
    });

    const res = await service.getItem("user-1", UserRole.client, "item-1", null);
    expect(Array.isArray(res.sections)).toBe(true);
    expect(res.sections).toEqual([{ title: "Client", text: "ok", audience: "Client" }]);
  });

  it("scopes signature requests list to client id for client role", async () => {
    prismaMock.clients.findUnique.mockResolvedValue({
      id: "client-1",
      therapist: { clinic_id: "clinic-1" },
    });
    prismaMock.form_signature_requests.findMany.mockResolvedValue([]);

    await service.listSignatureRequests("user-1", UserRole.client, {
      clinicId: null,
      status: null,
      clientId: null,
      itemId: null,
      limit: 50,
    });

    const args = prismaMock.form_signature_requests.findMany.mock.calls[0][0];
    expect(args.where.client_id).toBe("client-1");
  });

  it("blocks publish unless item is APPROVED", async () => {
    prismaMock.therapists.findUnique.mockResolvedValue({ id: "t-1", clinic_id: "clinic-1" });
    prismaMock.library_items.findFirst.mockResolvedValue({
      id: "item-1",
      clinic_id: "clinic-1",
      status: "DRAFT",
      version: 1,
      title: "X",
      content_type: "Therapeutic",
      metadata: {},
      sections: [],
    });

    await expect(
      service.publishItem("user-1", UserRole.therapist, "item-1", { changeSummary: "x" } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks submit unless item is DRAFT", async () => {
    prismaMock.therapists.findUnique.mockResolvedValue({ id: "t-1", clinic_id: "clinic-1" });
    prismaMock.library_items.findFirst.mockResolvedValue({
      id: "item-1",
      clinic_id: "clinic-1",
      status: "PUBLISHED",
    });

    await expect(service.submitItem("user-1", UserRole.therapist, "item-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
