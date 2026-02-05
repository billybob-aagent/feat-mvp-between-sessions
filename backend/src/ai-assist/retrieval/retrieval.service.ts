import { Injectable } from "@nestjs/common";
import { LibraryItemStatus } from "@prisma/client";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { extractKeywords, scoreText } from "../utils/determinism";

export type RetrievedSource = {
  id: string;
  itemId: string;
  title: string;
  headingPath: string;
  text: string;
  score: number;
};

@Injectable()
export class RetrievalService {
  constructor(private prisma: PrismaService) {}

  async retrieveApprovedSources(params: {
    clinicId: string;
    query: string;
    limit: number;
  }): Promise<{ sources: RetrievedSource[]; sourceItemIds: string[] }>
  {
    const q = params.query.trim();
    const keywords = extractKeywords(q, 3);
    if (!q || keywords.length === 0) {
      return { sources: [], sourceItemIds: [] };
    }

    const orClauses = keywords.map((keyword) => ({
      text: { contains: keyword, mode: "insensitive" as const },
    }));

    const chunks = await this.prisma.library_chunks.findMany({
      where: {
        item: {
          clinic_id: params.clinicId,
          status: LibraryItemStatus.PUBLISHED,
        },
        OR: orClauses,
      },
      take: Math.max(params.limit * 4, 20),
      include: {
        item: { select: { id: true, title: true } },
      },
    });

    const scored = chunks
      .map((chunk) => {
        const sourceText = `${chunk.item.title} ${chunk.heading_path} ${chunk.text}`;
        const score = scoreText(sourceText, keywords);
        return {
          id: chunk.id,
          itemId: chunk.item.id,
          title: chunk.item.title,
          headingPath: chunk.heading_path,
          text: chunk.text,
          score,
        };
      })
      .filter((entry) => entry.score > 0);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });

    const sources = scored.slice(0, params.limit);
    const sourceItemIds: string[] = [];
    for (const source of sources) {
      if (!sourceItemIds.includes(source.itemId)) {
        sourceItemIds.push(source.itemId);
      }
    }

    return { sources, sourceItemIds };
  }
}
