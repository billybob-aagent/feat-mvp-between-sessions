import { createHash } from "crypto";
import { AerPdfController } from "./aer-pdf.controller";

function hash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

describe("AerPdfController", () => {
  it("returns deterministic PDF buffers even if audit logging fails", async () => {
    const aerPdf = {
      generatePdfReport: jest.fn().mockImplementation(() => ({
        buffer: Buffer.from("pdf-buffer"),
        reportId: "AER-v1:clinic-1:client-1:2026-01-01:2026-01-31",
      })),
    };
    const aerReport = {
      ensureClinicAccess: jest.fn().mockResolvedValue(undefined),
    };
    const audit = {
      log: jest.fn().mockRejectedValue(new Error("audit down")),
    };

    const controller = new AerPdfController(aerPdf as any, aerReport as any, audit as any);
    const req = {
      user: { userId: "user-1", role: "admin" },
      ip: "127.0.0.1",
      headers: { "user-agent": "jest" },
    } as any;
    const res = {
      setHeader: jest.fn(),
    } as any;

    const first = await controller.generatePdf(
      req,
      "clinic-1",
      "client-1",
      res,
      "2026-01-01",
      "2026-01-31",
      undefined,
    );
    const second = await controller.generatePdf(
      req,
      "clinic-1",
      "client-1",
      res,
      "2026-01-01",
      "2026-01-31",
      undefined,
    );

    expect(hash(first)).toBe(hash(second));
    expect(audit.log).toHaveBeenCalled();
  });
});
