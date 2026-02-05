import { ExternalAccessPublicController } from "./external-access.public.controller";

describe("ExternalAccessPublicController", () => {
  it("applies a stricter throttler limit for external routes", () => {
    const limit = Reflect.getMetadata(
      "THROTTLER:LIMITdefault",
      ExternalAccessPublicController,
    );
    const ttl = Reflect.getMetadata(
      "THROTTLER:TTLdefault",
      ExternalAccessPublicController,
    );

    expect(limit).toBe(30);
    expect(ttl).toBe(60_000);
  });
});
