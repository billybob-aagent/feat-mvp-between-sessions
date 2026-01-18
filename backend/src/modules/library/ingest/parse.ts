export type Section = {
  headingPath: string;
  title: string;
  text: string;
  sectionType: string;
  audience: string;
};

const KNOWN_SECTION_HEADERS = [
  "Purpose",
  "Overview",
  "Instructions",
  "Instructions for Clinicians",
  "Instructions for Clients",
  "Clinical Notes",
  "Clinician Notes",
  "Therapist Notes",
  "Risk, Limitations & Legal Considerations",
  "Risk, Limitations and Legal Considerations",
  "Risk, Limitations & Legal",
  "Scope & Use Statement",
  "Scope and Use Statement",
  "Signature Blocks",
  "Versioning & Update Notes",
  "Versioning and Update Notes",
  "Interpretation Guidelines",
  "Clinical Action & Decision Notes",
  "Clinical Action and Decision Notes",
  "Contraindications/Risks/Escalation",
  "Contraindications and Risks",
  "Privacy Notes",
  "Scoring",
  "Administration",
  "Clinical Action",
  "Contraindications",
  "Cautions",
];

export function normalizeWhitespace(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 80);
}

export function isHeadingLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length < 4 || trimmed.length > 120) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 10) return false;
  const isAllCaps = trimmed.toUpperCase() === trimmed && /[A-Z]/.test(trimmed);
  const endsWithColon = trimmed.endsWith(":");
  const isKnown = KNOWN_SECTION_HEADERS.some(
    (header) => header.toLowerCase() === trimmed.toLowerCase(),
  );
  return isAllCaps || endsWithColon || isKnown;
}

export function splitItems(text: string) {
  const lines = text.split("\n");
  const items: { title: string; body: string }[] = [];
  let currentTitle = "Untitled Item";
  let buffer: string[] = [];
  let started = false;

  for (const line of lines) {
    if (isHeadingLine(line) && line.trim().length > 6) {
      if (started && buffer.length > 5) {
        items.push({ title: currentTitle, body: buffer.join("\n") });
        buffer = [];
      }
      currentTitle = line.replace(/:$/, "").trim();
      started = true;
      continue;
    }
    buffer.push(line);
  }

  if (buffer.length) {
    items.push({ title: currentTitle, body: buffer.join("\n") });
  }

  return items.filter((item) => item.body.trim().length > 0);
}

export function splitSections(
  itemTitle: string,
  body: string,
  collectionTitle: string,
) {
  const lines = body.split("\n");
  const sections: Section[] = [];
  let currentTitle = "Overview";
  let buffer: string[] = [];

  const flush = () => {
    const text = normalizeWhitespace(buffer.join("\n"));
    if (!text) return;
    const headingPath = `${collectionTitle} > ${itemTitle} > ${currentTitle}`;
    const audience = currentTitle.toLowerCase().includes("client")
      ? "Client"
      : "Clinician";
    sections.push({
      headingPath,
      title: currentTitle,
      text,
      sectionType: currentTitle,
      audience,
    });
  };

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush();
      currentTitle = line.replace(/:$/, "").trim();
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  flush();
  return sections;
}

export function buildMetadata(contentType: string) {
  return {
    contentType,
    primaryClinicalDomains: [],
    applicableModalities: [],
    targetPopulation: [],
    clinicalSetting: [],
    clinicalComplexityLevel: null,
    sessionUse: null,
    evidenceBasis: null,
    customizationRequired: {
      required: false,
      notes: null,
    },
  };
}
