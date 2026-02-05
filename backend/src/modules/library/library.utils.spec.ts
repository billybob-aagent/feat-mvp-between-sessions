import { BadRequestException } from "@nestjs/common";
import { assertPublishable, buildChunks, normalizeMetadata, normalizeSections } from "./library.utils";

describe("library utils", () => {
  it("normalizes metadata with required fields", () => {
    const metadata = normalizeMetadata({}, "Form");
    expect(metadata.contentType).toBe("Form");
    expect(metadata.primaryClinicalDomains).toEqual([]);
    expect(metadata.customizationRequired.required).toBe(false);
  });

  it("normalizes sections from array input", () => {
    const sections = normalizeSections([
      { title: "Overview", text: "Hello world", headingPath: "X > Y" },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Overview");
  });

  it("rejects invalid sections", () => {
    expect(() => normalizeSections({} as any)).toThrow(BadRequestException);
  });

  it("enforces publishable form sections", () => {
    expect(() =>
      assertPublishable({
        content_type: "Form",
        sections: [{ title: "Overview", text: "Test" }],
      }),
    ).toThrow(BadRequestException);
  });

  it("builds chunks with overlap", () => {
    const chunks = buildChunks(
      "Item",
      [{ title: "Section", headingPath: "Item > Section", text: "one two three" }],
      1,
      2,
      1,
    );
    expect(chunks.length).toBeGreaterThan(1);
  });
});
