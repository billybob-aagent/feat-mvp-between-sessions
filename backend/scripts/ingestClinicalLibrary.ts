import { PrismaClient, LibraryItemStatus } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import pdfParse from "pdf-parse";
import {
  buildMetadata,
  normalizeWhitespace,
  slugify,
  splitItems,
  splitSections,
  Section,
} from "../src/modules/library/ingest/parse";
import { buildChunks } from "../src/modules/library/library.utils";

type PdfSource = {
  key: string;
  label: string;
  contentType: string;
  filePath: string;
};

const prisma = new PrismaClient();

const SOURCES: PdfSource[] = [
  {
    key: "forms",
    label: "Forms Pack",
    contentType: "Form",
    filePath:
      process.env.FORMS_PDF_PATH || "Between_Sessions_Forms_Pack.pdf",
  },
  {
    key: "assessments",
    label: "Assessments Pack",
    contentType: "Assessment",
    filePath:
      process.env.ASSESSMENTS_PDF_PATH || "Between_Sessions_Assessments_Pack.pdf",
  },
  {
    key: "therapeutic",
    label: "Therapeutic Content Pack",
    contentType: "Therapeutic Content",
    filePath:
      process.env.THERAPEUTIC_PDF_PATH ||
      "Between_Sessions_Therapeutic_Content_Pack.pdf",
  },
];

const COLLECTION_TITLE = "Between Sessions Clinical Library";

function readPdfText(filePath: string) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Missing PDF at ${resolved}`);
  }
  return pdfParse(fs.readFileSync(resolved)).then((data) => data.text);
}

function computeFingerprint(value: unknown) {
  return JSON.stringify(value);
}

async function ensureClinicId() {
  if (process.env.CLINIC_ID) return process.env.CLINIC_ID;
  const clinic = await prisma.clinics.findFirst({ orderBy: { created_at: "asc" } });
  if (!clinic) throw new Error("No clinic found. Set CLINIC_ID env var.");
  return clinic.id;
}

async function ensureCollection(clinicId: string) {
  const existing = await prisma.library_collections.findFirst({
    where: { clinic_id: clinicId, title: COLLECTION_TITLE },
  });
  if (existing) return existing;
  return prisma.library_collections.create({
    data: {
      clinic_id: clinicId,
      title: COLLECTION_TITLE,
      description: "Between Sessions clinical library pack ingestion",
    },
  });
}

async function upsertItem(params: {
  clinicId: string;
  collectionId: string;
  source: PdfSource;
  title: string;
  sections: Section[];
}) {
  const slug = `${params.source.key}-${slugify(params.title)}`;
  const metadata = buildMetadata(params.source.contentType);
  const contentType = params.source.contentType;
  const changeSummary = `Ingested from ${path.basename(params.source.filePath)}`;
  const importTimestamp = new Date();
  const fingerprint = computeFingerprint({
    title: params.title,
    contentType,
    metadata,
    sections: params.sections,
  });

  const existing = await prisma.library_items.findFirst({
    where: { clinic_id: params.clinicId, slug },
  });

  if (!existing) {
    const created = await prisma.library_items.create({
      data: {
        clinic_id: params.clinicId,
        collection_id: params.collectionId,
        slug,
        title: params.title,
        content_type: contentType,
        metadata: metadata as any,
        sections: params.sections as any,
        status: LibraryItemStatus.PUBLISHED,
        version: 1,
        source_file_name: path.basename(params.source.filePath),
        import_timestamp: importTimestamp,
      },
    });

    await prisma.library_item_versions.create({
      data: {
        item_id: created.id,
        version_number: 1,
        metadata_snapshot: metadata as any,
        sections_snapshot: params.sections as any,
        change_summary: changeSummary,
      },
    });

    const chunks = buildChunks(params.title, params.sections as any, 1, 1000, 120);
    await prisma.library_chunks.createMany({
      data: chunks.map((chunk) => ({
        item_id: created.id,
        version_number: 1,
        chunk_index: chunk.chunkIndex,
        heading_path: chunk.headingPath,
        text: chunk.text,
        token_count: chunk.tokenCount,
      })),
    });
    return;
  }

  const existingFingerprint = computeFingerprint({
    title: existing.title,
    contentType: existing.content_type,
    metadata: existing.metadata,
    sections: existing.sections,
  });
  if (existingFingerprint === fingerprint) {
    return;
  }

  const nextVersion = existing.version + 1;
  await prisma.library_items.update({
    where: { id: existing.id },
    data: {
      title: params.title,
      content_type: contentType,
      metadata: metadata as any,
      sections: params.sections as any,
      status: LibraryItemStatus.PUBLISHED,
      version: nextVersion,
      source_file_name: path.basename(params.source.filePath),
      import_timestamp: importTimestamp,
    },
  });

  await prisma.library_item_versions.create({
    data: {
      item_id: existing.id,
      version_number: nextVersion,
      metadata_snapshot: metadata as any,
      sections_snapshot: params.sections as any,
      change_summary: changeSummary,
    },
  });

  await prisma.library_chunks.deleteMany({ where: { item_id: existing.id } });
  const chunks = buildChunks(params.title, params.sections as any, nextVersion, 1000, 120);
  await prisma.library_chunks.createMany({
    data: chunks.map((chunk) => ({
      item_id: existing.id,
      version_number: nextVersion,
      chunk_index: chunk.chunkIndex,
      heading_path: chunk.headingPath,
      text: chunk.text,
      token_count: chunk.tokenCount,
    })),
  });
}

async function ingest() {
  const clinicId = await ensureClinicId();
  const collection = await ensureCollection(clinicId);

  for (const source of SOURCES) {
    const text = await readPdfText(source.filePath);
    const normalized = normalizeWhitespace(text);
    const items = splitItems(normalized);
    if (items.length === 0) {
      throw new Error(`No items found in ${source.filePath}`);
    }

    for (const item of items) {
      const sections = splitSections(item.title, item.body, COLLECTION_TITLE);
      await upsertItem({
        clinicId,
        collectionId: collection.id,
        source,
        title: item.title,
        sections,
      });
    }
  }
}

ingest()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
