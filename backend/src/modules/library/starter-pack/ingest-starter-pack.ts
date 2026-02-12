import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { LibraryItemStatus, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { buildChunks, normalizeMetadata } from "../library.utils";
import { slugify } from "../ingest/parse";

export type StarterPackSectionInput = {
  kind: "INSTRUCTIONS" | "CONTENT" | "CLINICIAN_NOTES";
  title: string;
  markdown: string;
};

export type StarterPackMeasure = {
  isMeasure: boolean;
  scoring: {
    type: "SUM" | "MEAN" | "RULES";
    range: { min: number; max: number };
    rulesMarkdown: string;
  } | null;
};

export type StarterPackItemInput = {
  title: string;
  slug: string;
  contentType: "WORKSHEET" | "PROMPT" | "HANDOUT" | "PSYCHOED" | "MEASURE";
  clinicalTags: string[];
  populations: string[];
  minutes?: number;
  clientSafe: boolean;
  language: "en";
  license: {
    type: "SELF_AUTHORED" | "PUBLIC_DOMAIN" | string;
    sourceName: string;
    sourceUrl: string | null;
    publicDomainNotice: string | null;
  };
  sections: StarterPackSectionInput[];
  measure: StarterPackMeasure;
};

export type StarterPackItemNormalized = StarterPackItemInput & {
  slug: string;
  clinicalTags: string[];
  populations: string[];
  minutes: number;
};

export type StarterPackIngestSummary = {
  ok: boolean;
  created_items: number;
  updated_items: number;
  skipped_same_checksum: number;
  created_versions: number;
  validation_errors: string[];
};

const ALLOWED_CONTENT_TYPES = new Set(["WORKSHEET", "PROMPT", "HANDOUT", "PSYCHOED", "MEASURE"]);
const ALLOWED_SECTION_KINDS = new Set(["INSTRUCTIONS", "CONTENT", "CLINICIAN_NOTES"]);
const ALLOWED_POPULATIONS = new Set(["ADULT", "ADOLESCENT", "FAMILY", "COUPLES"]);
const ALLOWED_MINUTES = new Set([5, 10, 15, 20, 30]);
const DEFAULT_MINUTES = 10;

const STARTER_COLLECTION_TITLE = "Starter Library Pack v1";
const STARTER_COLLECTION_DESCRIPTION = "Self-authored Between Sessions starter pack v1.";

const baseDir = process.cwd().endsWith(path.sep + "backend")
  ? process.cwd()
  : path.join(process.cwd(), "backend");

export const STARTER_PACK_DIR = path.join(
  baseDir,
  "assets",
  "library",
  "starter-pack-v1",
  "items",
);

const normalizeTag = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePopulation = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
  );
  return `{${entries.join(",")}}`;
};

export const buildStarterPackChecksum = (item: StarterPackItemNormalized) => {
  const payload = {
    title: item.title,
    slug: item.slug,
    contentType: item.contentType,
    sections: item.sections.map((section) => section.markdown),
    measure: item.measure,
    tags: [...item.clinicalTags].sort(),
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
};

const buildExistingChecksum = (params: {
  title: string;
  slug: string;
  contentType: string;
  sections: Array<{ text?: string } | { markdown?: string }>;
  tags: string[];
  measure: StarterPackMeasure | null;
}) => {
  const payload = {
    title: params.title,
    slug: params.slug,
    contentType: params.contentType,
    sections: params.sections.map((section) =>
      typeof (section as any)?.markdown === "string"
        ? String((section as any).markdown)
        : String((section as any)?.text ?? ""),
    ),
    measure: params.measure,
    tags: [...params.tags].sort(),
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
};

export function validateStarterPackItem(raw: any, label: string): string[] {
  const errors: string[] = [];
  const add = (msg: string) => errors.push(`${label}: ${msg}`);

  if (!raw || typeof raw !== "object") {
    add("Item must be an object");
    return errors;
  }
  if (typeof raw.title !== "string" || !raw.title.trim()) add("Missing title");
  if (typeof raw.slug !== "string" || !raw.slug.trim()) add("Missing slug");
  if (!ALLOWED_CONTENT_TYPES.has(raw.contentType)) add("Invalid contentType");
  if (!Array.isArray(raw.clinicalTags) || raw.clinicalTags.length === 0)
    add("clinicalTags must be a non-empty array");
  if (!Array.isArray(raw.populations) || raw.populations.length === 0)
    add("populations must be a non-empty array");
  if (raw.minutes !== undefined && !ALLOWED_MINUTES.has(Number(raw.minutes)))
    add("minutes must be one of 5,10,15,20,30");
  if (raw.clientSafe !== true) add("clientSafe must be true");
  if (raw.language !== "en") add("language must be 'en'");
  if (!raw.license || typeof raw.license !== "object") add("license is required");
  if (raw.license?.type !== "SELF_AUTHORED") add("license.type must be SELF_AUTHORED");
  if (!Array.isArray(raw.sections) || raw.sections.length !== 3)
    add("sections must be an array of length 3");
  if (Array.isArray(raw.sections)) {
    const kinds = raw.sections.map((s: any) => s?.kind);
    for (const required of ALLOWED_SECTION_KINDS) {
      if (!kinds.includes(required)) add(`Missing section kind ${required}`);
    }
    raw.sections.forEach((section: any, idx: number) => {
      if (!ALLOWED_SECTION_KINDS.has(section?.kind)) add(`Invalid section kind at ${idx}`);
      if (typeof section?.title !== "string" || !section.title.trim())
        add(`Section title missing at ${idx}`);
      if (typeof section?.markdown !== "string" || !section.markdown.trim())
        add(`Section markdown missing at ${idx}`);
    });
  }
  if (!raw.measure || typeof raw.measure !== "object") {
    add("measure is required");
  } else {
    if (typeof raw.measure.isMeasure !== "boolean") add("measure.isMeasure must be boolean");
    if (raw.measure.isMeasure) {
      const scoring = raw.measure.scoring;
      if (!scoring || typeof scoring !== "object") {
        add("measure.scoring is required when isMeasure is true");
      } else {
        if (!["SUM", "MEAN", "RULES"].includes(scoring.type))
          add("measure.scoring.type invalid");
        if (!scoring.range || typeof scoring.range.min !== "number" || typeof scoring.range.max !== "number")
          add("measure.scoring.range invalid");
        if (typeof scoring.rulesMarkdown !== "string") add("measure.scoring.rulesMarkdown missing");
      }
    }
  }

  return errors;
}

export function normalizeStarterPackItems(rawItems: StarterPackItemInput[]) {
  const normalized: StarterPackItemNormalized[] = [];
  const slugCounts = new Map<string, number>();

  for (const raw of rawItems) {
    const baseSlug = slugify(raw.slug || raw.title || "");
    const minutes = raw.minutes && ALLOWED_MINUTES.has(raw.minutes) ? raw.minutes : DEFAULT_MINUTES;
    const tags = Array.from(
      new Set(
        (raw.clinicalTags || [])
          .map((t) => normalizeTag(String(t)))
          .filter((t) => t.length > 0),
      ),
    );
    const populations = Array.from(
      new Set(
        (raw.populations || [])
          .map((p) => normalizePopulation(String(p)))
          .filter((p) => ALLOWED_POPULATIONS.has(p)),
      ),
    );

    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const suffix = count > 0 ? `-${count + 1}` : "";
    const finalSlug = `${baseSlug}${suffix}`;

    normalized.push({
      ...raw,
      slug: finalSlug,
      minutes,
      clinicalTags: tags,
      populations,
    });
  }

  return normalized;
}

export function loadStarterPackItems(dir = STARTER_PACK_DIR) {
  const entries = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  const rawItems: StarterPackItemInput[] = [];
  const errors: string[] = [];

  for (const name of entries) {
    const filePath = path.join(dir, name);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const validation = validateStarterPackItem(raw, name);
      if (validation.length) {
        errors.push(...validation);
        continue;
      }
      rawItems.push(raw);
    } catch (err) {
      errors.push(`${name}: Invalid JSON (${err instanceof Error ? err.message : "parse error"})`);
    }
  }

  if (errors.length) {
    return { items: [], errors };
  }

  return { items: normalizeStarterPackItems(rawItems), errors: [] };
}

const buildSections = (title: string, sectionInputs: StarterPackSectionInput[], collectionTitle: string) =>
  sectionInputs.map((section) => ({
    headingPath: `${collectionTitle} > ${title} > ${section.title}`,
    title: section.title,
    text: section.markdown,
    sectionType: section.kind,
    audience: section.kind === "CLINICIAN_NOTES" ? "Clinician" : "Client",
  }));

const buildMetadata = (item: StarterPackItemNormalized) => {
  const modalityTags = ["CBT", "DBT", "MI", "RELAPSE_PREVENTION"];
  const domainTags = [
    "ANXIETY",
    "DEPRESSION",
    "TRAUMA",
    "SUD",
    "SLEEP",
    "ANGER",
    "GRIEF",
    "PARENTING",
    "STRESS",
  ];

  const metadata = normalizeMetadata(
    {
      contentType: item.contentType,
      primaryClinicalDomains: item.clinicalTags.filter((tag) => domainTags.includes(tag)),
      applicableModalities: item.clinicalTags.filter((tag) => modalityTags.includes(tag)),
      targetPopulation: item.populations,
      clinicalSetting: [],
      clinicalComplexityLevel: "low",
      sessionUse: "between-session",
      evidenceBasis: "Self-authored template",
      customizationRequired: {
        required: true,
        notes: "Review and tailor to client context.",
      },
    },
    item.contentType,
  );

  return {
    ...metadata,
    starterPack: {
      version: "v1",
      minutes: item.minutes,
      clientSafe: item.clientSafe,
      license: item.license,
      measure: item.measure,
      clinicalTags: item.clinicalTags,
      populations: item.populations,
    },
  };
};

const ensureCollection = async (prisma: PrismaClient, clinicId: string) => {
  const existing = await prisma.library_collections.findFirst({
    where: { clinic_id: clinicId, title: STARTER_COLLECTION_TITLE },
  });
  if (existing) return existing;
  return prisma.library_collections.create({
    data: {
      clinic_id: clinicId,
      title: STARTER_COLLECTION_TITLE,
      description: STARTER_COLLECTION_DESCRIPTION,
    },
  });
};

const resolveExistingTags = async (prisma: PrismaClient, itemId: string) => {
  const rows = await prisma.library_item_tags.findMany({
    where: { item_id: itemId },
    include: { tag: true },
  });
  return rows.map((row) => row.tag.name);
};

export const upsertStarterPackItem = async (params: {
  prisma: PrismaClient;
  clinicId: string;
  collectionId: string;
  userId?: string | null;
  item: StarterPackItemNormalized;
  sourceFileName: string;
}) => {
  const { prisma, clinicId, collectionId, userId, item } = params;
  const sections = buildSections(item.title, item.sections, STARTER_COLLECTION_TITLE);
  const metadata = buildMetadata(item);
  const checksum = buildStarterPackChecksum(item);

  let existing = await prisma.library_items.findFirst({
    where: { clinic_id: clinicId, slug: item.slug },
  });
  if (!existing) {
    existing = await prisma.library_items.findFirst({
      where: { clinic_id: clinicId, title: item.title },
    });
  }

  if (existing) {
    const tags = await resolveExistingTags(prisma, existing.id);
    const existingMeasure = (existing.metadata as any)?.starterPack?.measure ?? null;
    const existingChecksum = buildExistingChecksum({
      title: existing.title,
      slug: existing.slug,
      contentType: existing.content_type,
      sections: Array.isArray(existing.sections) ? existing.sections : (existing.sections as any)?.sections ?? [],
      tags,
      measure: existingMeasure,
    });

    if (existingChecksum === checksum) {
      return { action: "skipped" as const, createdVersions: 0 };
    }

    const nextVersion = existing.version + 1;
    await prisma.library_items.update({
      where: { id: existing.id },
      data: {
        collection_id: collectionId,
        slug: existing.slug,
        title: item.title,
        content_type: item.contentType,
        metadata: metadata as any,
        sections: sections as any,
        status: LibraryItemStatus.DRAFT,
        version: nextVersion,
        updated_by: userId ?? null,
        source_file_name: params.sourceFileName,
        import_timestamp: new Date(0),
      },
    });

    await prisma.library_item_versions.create({
      data: {
        item_id: existing.id,
        version_number: nextVersion,
        metadata_snapshot: metadata as any,
        sections_snapshot: sections as any,
        change_summary: "Starter pack v1 update",
        created_by: userId ?? null,
      },
    });

    await prisma.library_item_tags.deleteMany({ where: { item_id: existing.id } });
    if (item.clinicalTags.length) {
      const tags = await Promise.all(
        item.clinicalTags.map((name) =>
          prisma.library_tags.upsert({
            where: { clinic_id_name: { clinic_id: clinicId, name } },
            update: {},
            create: { clinic_id: clinicId, name },
          }),
        ),
      );
      await prisma.library_item_tags.createMany({
        data: tags.map((tag) => ({ item_id: existing.id, tag_id: tag.id })),
        skipDuplicates: true,
      });
    }

    await prisma.library_chunks.deleteMany({ where: { item_id: existing.id } });
    const chunks = buildChunks(item.title, sections as any, nextVersion);
    if (chunks.length) {
      await prisma.library_chunks.createMany({
        data: chunks.map((chunk) => ({
          item_id: existing.id,
          version_number: chunk.versionNumber,
          chunk_index: chunk.chunkIndex,
          heading_path: chunk.headingPath,
          text: chunk.text,
          token_count: chunk.tokenCount,
        })),
      });
    }

    return { action: "updated" as const, createdVersions: 1 };
  }

  const created = await prisma.library_items.create({
    data: {
      clinic_id: clinicId,
      collection_id: collectionId,
      slug: item.slug,
      title: item.title,
      content_type: item.contentType,
      metadata: metadata as any,
      sections: sections as any,
      status: LibraryItemStatus.DRAFT,
      version: 1,
      created_by: userId ?? null,
      updated_by: userId ?? null,
      source_file_name: params.sourceFileName,
      import_timestamp: new Date(0),
    },
  });

  await prisma.library_item_versions.create({
    data: {
      item_id: created.id,
      version_number: 1,
      metadata_snapshot: metadata as any,
      sections_snapshot: sections as any,
      change_summary: "Starter pack v1 import",
      created_by: userId ?? null,
    },
  });

  if (item.clinicalTags.length) {
    const tags = await Promise.all(
      item.clinicalTags.map((name) =>
        prisma.library_tags.upsert({
          where: { clinic_id_name: { clinic_id: clinicId, name } },
          update: {},
          create: { clinic_id: clinicId, name },
        }),
      ),
    );
    await prisma.library_item_tags.createMany({
      data: tags.map((tag) => ({ item_id: created.id, tag_id: tag.id })),
      skipDuplicates: true,
    });
  }

  const chunks = buildChunks(item.title, sections as any, 1);
  if (chunks.length) {
    await prisma.library_chunks.createMany({
      data: chunks.map((chunk) => ({
        item_id: created.id,
        version_number: chunk.versionNumber,
        chunk_index: chunk.chunkIndex,
        heading_path: chunk.headingPath,
        text: chunk.text,
        token_count: chunk.tokenCount,
      })),
    });
  }

  return { action: "created" as const, createdVersions: 1 };
};

export async function ingestStarterPack(params: {
  prisma: PrismaClient;
  clinicId: string;
  userId?: string | null;
  actorRole?: UserRole | null;
}) {
  const { items, errors } = loadStarterPackItems();
  if (errors.length) {
    return {
      ok: false,
      created_items: 0,
      updated_items: 0,
      skipped_same_checksum: 0,
      created_versions: 0,
      validation_errors: errors,
    } as StarterPackIngestSummary;
  }

  const collection = await ensureCollection(params.prisma, params.clinicId);

  const summary: StarterPackIngestSummary = {
    ok: true,
    created_items: 0,
    updated_items: 0,
    skipped_same_checksum: 0,
    created_versions: 0,
    validation_errors: [],
  };

  for (const item of items) {
    const result = await upsertStarterPackItem({
      prisma: params.prisma,
      clinicId: params.clinicId,
      collectionId: collection.id,
      userId: params.userId ?? null,
      item,
      sourceFileName: `starter-pack-v1/${item.slug}.json`,
    });

    if (result.action === "created") summary.created_items += 1;
    if (result.action === "updated") summary.updated_items += 1;
    if (result.action === "skipped") summary.skipped_same_checksum += 1;
    summary.created_versions += result.createdVersions;
  }

  return summary;
}
