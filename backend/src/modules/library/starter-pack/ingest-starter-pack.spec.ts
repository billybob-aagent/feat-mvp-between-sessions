import {
  buildStarterPackChecksum,
  normalizeStarterPackItems,
  upsertStarterPackItem,
  validateStarterPackItem,
  type StarterPackItemInput,
} from "./ingest-starter-pack";

const baseItem: StarterPackItemInput = {
  title: "Sample Item",
  slug: "sample-item",
  contentType: "WORKSHEET",
  clinicalTags: ["CBT", "ANXIETY"],
  populations: ["ADULT"],
  minutes: 10,
  clientSafe: true,
  language: "en",
  license: {
    type: "SELF_AUTHORED",
    sourceName: "Between Sessions Starter Pack v1",
    sourceUrl: null,
    publicDomainNotice: null,
  },
  sections: [
    { kind: "INSTRUCTIONS", title: "Instructions", markdown: "Step 1" },
    { kind: "CONTENT", title: "Client worksheet", markdown: "Content" },
    { kind: "CLINICIAN_NOTES", title: "Clinician notes", markdown: "Notes" },
  ],
  measure: { isMeasure: false, scoring: null },
};

describe("starter pack ingest utils", () => {
  it("validates schema fields", () => {
    const invalid = { ...baseItem, contentType: "BAD" } as any;
    const errors = validateStarterPackItem(invalid, "bad.json");
    expect(errors.some((e) => e.includes("Invalid contentType"))).toBe(true);
  });

  it("produces stable checksum regardless of tag order", () => {
    const itemA = normalizeStarterPackItems([baseItem])[0];
    const itemB = normalizeStarterPackItems([
      { ...baseItem, clinicalTags: ["ANXIETY", "CBT"] },
    ])[0];
    expect(buildStarterPackChecksum(itemA)).toBe(buildStarterPackChecksum(itemB));
  });

  it("handles slug collisions deterministically", () => {
    const items = normalizeStarterPackItems([
      baseItem,
      { ...baseItem, title: "Sample Item Copy", slug: "sample-item" },
    ]);
    expect(items[0].slug).toBe("sample-item");
    expect(items[1].slug).toBe("sample-item-2");
  });
});

describe("starter pack upsert", () => {
  const clinicId = "clinic-1";
  const collectionId = "col-1";
  const userId = "user-1";

  const buildPrisma = () => {
    return {
      library_items: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      library_item_versions: { create: jest.fn() },
      library_item_tags: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      library_tags: { upsert: jest.fn() },
      library_chunks: { createMany: jest.fn(), deleteMany: jest.fn() },
    };
  };

  it("skips when checksum matches", async () => {
    const prisma = buildPrisma();
    const normalized = normalizeStarterPackItems([baseItem])[0];

    prisma.library_items.findFirst.mockResolvedValueOnce({
      id: "item-1",
      clinic_id: clinicId,
      slug: normalized.slug,
      title: normalized.title,
      content_type: normalized.contentType,
      sections: normalized.sections.map((s) => ({ text: s.markdown })),
      metadata: { starterPack: { measure: normalized.measure } },
      version: 1,
    });
    prisma.library_item_tags.findMany.mockResolvedValueOnce([
      { tag: { name: "CBT" } },
      { tag: { name: "ANXIETY" } },
    ]);

    const result = await upsertStarterPackItem({
      prisma: prisma as any,
      clinicId,
      collectionId,
      userId,
      item: normalized,
      sourceFileName: "starter-pack-v1/sample.json",
    });

    expect(result.action).toBe("skipped");
    expect(prisma.library_items.update).not.toHaveBeenCalled();
    expect(prisma.library_item_versions.create).not.toHaveBeenCalled();
  });

  it("creates new version when checksum differs", async () => {
    const prisma = buildPrisma();
    const normalized = normalizeStarterPackItems([baseItem])[0];

    prisma.library_items.findFirst.mockResolvedValueOnce({
      id: "item-2",
      clinic_id: clinicId,
      slug: normalized.slug,
      title: normalized.title,
      content_type: normalized.contentType,
      sections: [{ text: "different" }],
      metadata: { starterPack: { measure: { isMeasure: false, scoring: null } } },
      version: 2,
    });
    prisma.library_item_tags.findMany.mockResolvedValueOnce([
      { tag: { name: "CBT" } },
      { tag: { name: "ANXIETY" } },
    ]);
    prisma.library_tags.upsert.mockImplementation(({ create }: any) => Promise.resolve({ id: create.name }));

    const result = await upsertStarterPackItem({
      prisma: prisma as any,
      clinicId,
      collectionId,
      userId,
      item: normalized,
      sourceFileName: "starter-pack-v1/sample.json",
    });

    expect(result.action).toBe("updated");
    expect(prisma.library_items.update).toHaveBeenCalled();
    expect(prisma.library_item_versions.create).toHaveBeenCalled();
  });
});
