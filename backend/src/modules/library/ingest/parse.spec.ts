import { normalizeWhitespace, splitItems, splitSections } from "./parse";

describe("library ingest parse", () => {
  it("splits items on headings", () => {
    const text = normalizeWhitespace(
      "FORM A\nThis is body text.\n\nFORM B\nSecond body.",
    );
    const items = splitItems(text);
    expect(items.length).toBeGreaterThan(1);
    expect(items[0].title).toContain("FORM");
  });

  it("splits sections by headings", () => {
    const sections = splitSections(
      "Sample Form",
      "Overview:\nIntro text.\n\nInstructions:\nDo the thing.",
      "Collection",
    );
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].title.toLowerCase()).toContain("overview");
  });
});
