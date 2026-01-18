import { BadRequestException } from "@nestjs/common";

export type LibraryMetadata = {
  contentType: string | null;
  primaryClinicalDomains: string[];
  applicableModalities: string[];
  targetPopulation: string[];
  clinicalSetting: string[];
  clinicalComplexityLevel: string | null;
  sessionUse: string | null;
  evidenceBasis: string | null;
  customizationRequired: {
    required: boolean;
    notes: string | null;
  };
};

export type LibrarySection = {
  headingPath: string;
  title: string;
  text: string;
  sectionType?: string;
  audience?: string;
};

const REQUIRED_METADATA_FIELDS: (keyof LibraryMetadata)[] = [
  "contentType",
  "primaryClinicalDomains",
  "applicableModalities",
  "targetPopulation",
  "clinicalSetting",
  "clinicalComplexityLevel",
  "sessionUse",
  "evidenceBasis",
  "customizationRequired",
];

const FORM_REQUIRED_SECTIONS = [
  "scope & use statement",
  "risk, limitations & legal considerations",
  "signature blocks",
  "versioning & update notes",
];

const ASSESSMENT_REQUIRED_SECTIONS = [
  "interpretation guidelines",
  "clinical action & decision notes",
  "contraindications/risks/escalation",
  "privacy notes",
];

export function normalizeMetadata(input: Record<string, any>, contentType: string): LibraryMetadata {
  const meta: LibraryMetadata = {
    contentType: typeof input?.contentType === "string" ? input.contentType : contentType,
    primaryClinicalDomains: Array.isArray(input?.primaryClinicalDomains)
      ? input.primaryClinicalDomains.map(String)
      : [],
    applicableModalities: Array.isArray(input?.applicableModalities)
      ? input.applicableModalities.map(String)
      : [],
    targetPopulation: Array.isArray(input?.targetPopulation)
      ? input.targetPopulation.map(String)
      : [],
    clinicalSetting: Array.isArray(input?.clinicalSetting)
      ? input.clinicalSetting.map(String)
      : [],
    clinicalComplexityLevel:
      typeof input?.clinicalComplexityLevel === "string"
        ? input.clinicalComplexityLevel
        : null,
    sessionUse: typeof input?.sessionUse === "string" ? input.sessionUse : null,
    evidenceBasis: typeof input?.evidenceBasis === "string" ? input.evidenceBasis : null,
    customizationRequired: {
      required: Boolean(input?.customizationRequired?.required ?? false),
      notes:
        typeof input?.customizationRequired?.notes === "string"
          ? input.customizationRequired.notes
          : null,
    },
  };

  for (const key of REQUIRED_METADATA_FIELDS) {
    if (meta[key] === undefined) {
      throw new BadRequestException(`Missing metadata field: ${key}`);
    }
  }

  return meta;
}

export function normalizeSections(input: Record<string, any>): LibrarySection[] {
  const raw = Array.isArray(input) ? input : input?.sections;
  if (!Array.isArray(raw)) {
    throw new BadRequestException("Sections must be an array");
  }
  return raw
    .map((section: any) => {
      const title = typeof section?.title === "string" ? section.title : "Section";
      const headingPath =
        typeof section?.headingPath === "string" ? section.headingPath : title;
      const text = typeof section?.text === "string" ? section.text : "";
      const sectionType = typeof section?.sectionType === "string" ? section.sectionType : title;
      const audience = typeof section?.audience === "string" ? section.audience : undefined;
      return { headingPath, title, text, sectionType, audience };
    })
    .filter((section) => section.text.trim().length > 0);
}

export function assertPublishable(item: { content_type: string; sections: any }) {
  const contentType = item.content_type.toLowerCase();
  const sections = Array.isArray(item.sections) ? item.sections : item.sections?.sections ?? [];
  const headings: string[] = sections
    .map((section: any) => {
      if (typeof section?.title === "string") return section.title;
      if (typeof section?.sectionType === "string") return section.sectionType;
      if (typeof section?.headingPath === "string") {
        const parts = section.headingPath.split(">");
        return parts[parts.length - 1]?.trim();
      }
      return "";
    })
    .map((value: string) => value.toLowerCase())
    .filter(Boolean);

  const missing: string[] = [];
  if (contentType.includes("assessment")) {
    for (const required of ASSESSMENT_REQUIRED_SECTIONS) {
      if (!headings.some((heading: string) => heading.includes(required))) {
        missing.push(required);
      }
    }
  }

  if (contentType.includes("form")) {
    for (const required of FORM_REQUIRED_SECTIONS) {
      if (!headings.some((heading: string) => heading.includes(required))) {
        missing.push(required);
      }
    }
  }

  if (missing.length > 0) {
    throw new BadRequestException(
      `Cannot publish. Missing required sections: ${missing.join(", ")}`,
    );
  }
}

export function buildChunks(
  itemTitle: string,
  sections: LibrarySection[],
  versionNumber: number,
  maxTokens = 1000,
  overlap = 120,
) {
  const chunks: {
    headingPath: string;
    text: string;
    tokenCount: number;
    chunkIndex: number;
    versionNumber: number;
  }[] = [];

  let index = 0;
  for (const section of sections) {
    const headingPath = section.headingPath || `${itemTitle} > ${section.title || "Section"}`;
    const words = section.text.trim().split(/\s+/);
    if (words.length === 0) continue;
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + maxTokens, words.length);
      const slice = words.slice(start, end);
      const tokenCount = slice.length;
      chunks.push({
        headingPath,
        text: slice.join(" "),
        tokenCount,
        chunkIndex: index,
        versionNumber,
      });
      index += 1;
      if (end >= words.length) break;
      start = Math.max(0, end - overlap);
    }
  }
  return chunks;
}
