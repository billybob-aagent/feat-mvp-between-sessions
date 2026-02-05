import { RetrievalService } from "./retrieval.service";
import { LibraryItemStatus } from "@prisma/client";

const prismaMock = {
  library_chunks: {
    findMany: jest.fn(),
  },
};

describe("RetrievalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty when query has no keywords", async () => {
    const service = new RetrievalService(prismaMock as any);

    const result = await service.retrieveApprovedSources({
      clinicId: "clinic-1",
      query: "a an the",
      limit: 3,
    });

    expect(result.sources).toEqual([]);
    expect(result.sourceItemIds).toEqual([]);
    expect(prismaMock.library_chunks.findMany).not.toHaveBeenCalled();
  });

  it("scores and orders results deterministically", async () => {
    prismaMock.library_chunks.findMany.mockResolvedValue([
      {
        id: "chunk-2",
        heading_path: "Section",
        text: "coping skills practice",
        item: { id: "item-2", title: "Guide Two" },
      },
      {
        id: "chunk-1",
        heading_path: "Overview",
        text: "coping skills coping skills",
        item: { id: "item-1", title: "Guide One" },
      },
      {
        id: "chunk-3",
        heading_path: "Overview",
        text: "unrelated",
        item: { id: "item-3", title: "Other" },
      },
    ]);

    const service = new RetrievalService(prismaMock as any);

    const result = await service.retrieveApprovedSources({
      clinicId: "clinic-1",
      query: "Coping skills",
      limit: 2,
    });

    expect(prismaMock.library_chunks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          item: { clinic_id: "clinic-1", status: LibraryItemStatus.PUBLISHED },
        }),
      }),
    );

    expect(result.sources.length).toBe(2);
    expect(result.sources[0].id).toBe("chunk-1");
    expect(result.sources[1].id).toBe("chunk-2");
    expect(result.sourceItemIds).toEqual(["item-1", "item-2"]);
  });
});
