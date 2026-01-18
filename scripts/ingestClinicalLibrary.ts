import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type VolumeInput = {
  id: string;
  order: number;
  title: string;
  pdfPath: string;
};

type ParsedTool = {
  id: string;
  volumeId: string;
  title: string;
  order: number;
  contentType: string;
  clinicalComplexityLevel: 'Low' | 'Moderate' | 'HighAcuity';
  sessionUse: 'InSession' | 'BetweenSession' | 'Both';
  evidenceStrength: 'WellEstablished' | 'Emerging' | 'Mixed';
  primaryClinicalDomains: string[];
  applicableModalities: string[];
  targetPopulation: string[];
  clinicalSetting: string[];
  tags: string[];
  culturalAccessibilityNeurodivergence: string | null;
  telehealthDigitalAdaptations: string | null;
  internalPeerReviewStatement: string;
  crisisGuidance: string;
  contraindications: string[];
  cautions: string[];
  pdfPath: string;
  pageStart: number | null;
  pageEnd: number | null;
  sections: ParsedSection[];
  clientMaterials: ParsedClientMaterial[];
};

type ParsedSection = {
  id: string;
  toolId: string;
  sectionType: string;
  text: string;
  chunkOrder: number;
};

type ParsedClientMaterial = {
  id: string;
  toolId: string;
  materialType: 'handout' | 'worksheet' | 'exercise';
  title: string;
  text: string;
};

const prisma = new PrismaClient();

const LIBRARY_ID = 'between-sessions-clinical-library-v1';
const VOLUME_INPUTS: VolumeInput[] = [
  {
    id: 'vol-01-trauma-ptsd',
    order: 1,
    title: 'Volume 1 - Trauma and PTSD',
    pdfPath: 'sandbox:/mnt/data/Volume_1_-_Trauma_and_PTSD.pdf',
  },
  {
    id: 'vol-02-substance-use-relapse',
    order: 2,
    title: 'Volume 2 - Substance Use and Relapse Prevention',
    pdfPath: 'sandbox:/mnt/data/Volume_2_-_Substance_Use_and_Relapse_Prevention.pdf',
  },
  {
    id: 'vol-03-anxiety-panic',
    order: 3,
    title: 'Volume 3 - Anxiety and Panic Disorders',
    pdfPath: 'sandbox:/mnt/data/Volume_3_-_Anxiety_and_Panic_Disorders.pdf',
  },
  {
    id: 'vol-04-mood-disorders',
    order: 4,
    title: 'Volume 4 - Mood Disorders',
    pdfPath: 'sandbox:/mnt/data/Volume_4_-_Mood_Disorders.pdf',
  },
  {
    id: 'vol-05-couples-family-systems',
    order: 5,
    title: 'Volume 5 - Couples and Family Systems',
    pdfPath: 'sandbox:/mnt/data/Volume_5_-_Couples_and_Family_Systems.pdf',
  },
  {
    id: 'vol-06-child-adolescent',
    order: 6,
    title: 'Volume 6 - Child and Adolescent Care',
    pdfPath: 'sandbox:/mnt/data/Volume_6_-_Child_and_Adolescent_Care.pdf',
  },
  {
    id: 'vol-07-neurodivergent-care',
    order: 7,
    title: 'Volume 7 - Neurodivergent Care',
    pdfPath: 'sandbox:/mnt/data/Volume_7_-_Neurodivergent_Care.pdf',
  },
  {
    id: 'vol-08-grief-loss',
    order: 8,
    title: 'Volume 8 - Grief and Loss',
    pdfPath: 'sandbox:/mnt/data/Volume_8_-_Grief_and_Loss.pdf',
  },
  {
    id: 'vol-09-crisis-risk',
    order: 9,
    title: 'Volume 9 - Crisis and Risk Management',
    pdfPath: 'sandbox:/mnt/data/Volume_9_-_Crisis_and_Risk_Management.pdf',
  },
  {
    id: 'vol-10-cultural-identity',
    order: 10,
    title: 'Volume 10 - Cultural and Identity Work',
    pdfPath: 'sandbox:/mnt/data/Volume_10_-_Cultural_and_Identity_Work.pdf',
  },
];

const LABELS = [
  'Content Type',
  'Clinical Complexity Level',
  'Clinical Complexity',
  'Session Use',
  'Evidence Strength',
  'Primary Clinical Domains',
  'Primary Clinical Domain',
  'Applicable Modalities',
  'Target Population',
  'Clinical Setting',
  'Tags',
  'Cultural Accessibility & Neurodivergence',
  'Cultural Accessibility and Neurodivergence',
  'Telehealth & Digital Adaptations',
  'Telehealth and Digital Adaptations',
  'Internal Peer Review Statement',
  'Crisis Guidance',
  'Contraindications',
  'Cautions',
];

const KNOWN_LABEL_PATTERN = LABELS.map(escapeRegExp).join('|');

const MAX_SECTION_CHARS = 2000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripSandboxPrefix(pdfPath: string): string {
  if (pdfPath.startsWith('sandbox:')) {
    return pdfPath.replace(/^sandbox:/, '');
  }
  return pdfPath;
}

function readPdfText(pdfPath: string): string {
  const actualPath = stripSandboxPrefix(pdfPath);
  if (!fs.existsSync(actualPath)) {
    throw new Error(`PDF not found at ${actualPath}`);
  }
  try {
    const buffer = execFileSync('pdftotext', ['-layout', actualPath, '-']);
    return buffer.toString('utf8').replace(/\r\n/g, '\n');
  } catch (error) {
    throw new Error(
      `Failed to extract text from ${actualPath}. Ensure 'pdftotext' is installed.`,
    );
  }
}

function tryGetPdfPageCount(pdfPath: string): number | null {
  const actualPath = stripSandboxPrefix(pdfPath);
  try {
    const output = execFileSync('pdfinfo', [actualPath]).toString('utf8');
    const match = output.match(/Pages:\s+(\d+)/i);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
    return null;
  } catch (_error) {
    return null;
  }
}

function sha256File(pdfPath: string): string | null {
  const actualPath = stripSandboxPrefix(pdfPath);
  try {
    const buffer = fs.readFileSync(actualPath);
    return createHash('sha256').update(buffer).digest('hex');
  } catch (_error) {
    return null;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanValue(value: string): string {
  return normalizeWhitespace(value.replace(/[ \t]+\n/g, '\n')).trim();
}

function splitList(value: string | null): string[] {
  if (!value) return [];
  const raw = value
    .replace(/\n+/g, '\n')
    .replace(/[•·]/g, ',')
    .replace(/\s*[,;|]\s*/g, ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

function extractField(block: string, label: string): string | null {
  const labelPattern = escapeRegExp(label);
  const regex = new RegExp(
    `${labelPattern}\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*(?:${KNOWN_LABEL_PATTERN})\\s*[:\\-]|\\n\\s*Tool\\s+\\d+\\s*[:\\-]|$)`,
    'i',
  );
  const match = block.match(regex);
  if (!match) return null;
  return cleanValue(match[1]);
}

function extractByLabels(block: string): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const label of LABELS) {
    result[label] = extractField(block, label);
  }
  return result;
}

function parseComplexity(value: string): 'Low' | 'Moderate' | 'HighAcuity' {
  const normalized = value.toLowerCase();
  if (normalized.includes('high')) return 'HighAcuity';
  if (normalized.includes('moderate')) return 'Moderate';
  return 'Low';
}

function parseSessionUse(value: string): 'InSession' | 'BetweenSession' | 'Both' {
  const normalized = value.toLowerCase();
  if (normalized.includes('both')) return 'Both';
  if (normalized.includes('between')) return 'BetweenSession';
  return 'InSession';
}

function parseEvidenceStrength(value: string): 'WellEstablished' | 'Emerging' | 'Mixed' {
  const normalized = value.toLowerCase();
  if (normalized.includes('well')) return 'WellEstablished';
  if (normalized.includes('mixed')) return 'Mixed';
  return 'Emerging';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .slice(0, 64);
}

function stripMetadata(block: string): string {
  let body = block;
  for (const label of LABELS) {
    const labelPattern = escapeRegExp(label);
    const regex = new RegExp(
      `${labelPattern}\\s*[:\\-]\\s*[\\s\\S]*?(?=\\n\\s*(?:${KNOWN_LABEL_PATTERN})\\s*[:\\-]|\\n\\s*Tool\\s+\\d+\\s*[:\\-]|$)`,
      'i',
    );
    body = body.replace(regex, '');
  }
  return cleanValue(body);
}

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  if (/[:.]\s*$/.test(trimmed)) return true;
  if (LABELS.some((label) => trimmed.toLowerCase() === label.toLowerCase())) return false;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 10) return false;
  const hasLower = /[a-z]/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  return hasUpper && (hasLower || wordCount <= 4);
}

function splitSections(body: string): { header: string; text: string }[] {
  const lines = body.split('\n');
  const sections: { header: string; text: string }[] = [];
  let currentHeader = 'body';
  let currentLines: string[] = [];

  for (const line of lines) {
    if (isSectionHeader(line)) {
      const text = cleanValue(currentLines.join('\n'));
      if (text) {
        sections.push({ header: currentHeader, text });
      }
      currentHeader = line.trim().replace(/[:]\s*$/, '');
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  const finalText = cleanValue(currentLines.join('\n'));
  if (finalText) {
    sections.push({ header: currentHeader, text: finalText });
  }

  return sections;
}

function chunkSectionText(text: string): string[] {
  if (text.length <= MAX_SECTION_CHARS) {
    return [text];
  }
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer: string[] = [];
  let bufferLen = 0;

  for (const paragraph of paragraphs) {
    const chunkCandidate = paragraph.trim();
    if (!chunkCandidate) continue;
    const candidateLen = chunkCandidate.length + (buffer.length ? 2 : 0);
    if (bufferLen + candidateLen > MAX_SECTION_CHARS && buffer.length) {
      chunks.push(buffer.join('\n\n'));
      buffer = [chunkCandidate];
      bufferLen = chunkCandidate.length;
      continue;
    }
    buffer.push(chunkCandidate);
    bufferLen += candidateLen;
  }

  if (buffer.length) {
    chunks.push(buffer.join('\n\n'));
  }

  return chunks.length ? chunks : [text];
}

function detectClientMaterial(sectionHeader: string): 'handout' | 'worksheet' | 'exercise' | null {
  const normalized = sectionHeader.toLowerCase();
  if (normalized.includes('worksheet')) return 'worksheet';
  if (normalized.includes('exercise')) return 'exercise';
  if (normalized.includes('handout')) return 'handout';
  if (normalized.includes('client')) return 'handout';
  return null;
}

function parseToolsFromPdf(volume: VolumeInput): ParsedTool[] {
  const text = readPdfText(volume.pdfPath);
  const toolHeaderRegex = /^\s*Tool\s+(\d{1,2})\s*[:\-]\s*(.+)$/gim;
  const matches = Array.from(text.matchAll(toolHeaderRegex));
  if (!matches.length) {
    throw new Error(`No tools found in ${volume.pdfPath}`);
  }

  const tools: ParsedTool[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const startIndex = match.index ?? 0;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    const block = text.slice(startIndex, endIndex);
    const toolNumber = Number.parseInt(match[1], 10);
    const toolTitle = cleanValue(match[2] ?? `Tool ${toolNumber}`);
    const toolOrder = i + 1;
    const toolId = `vol-${String(volume.order).padStart(2, '0')}-tool-${String(toolOrder).padStart(2, '0')}-${slugify(toolTitle)}`;

    const extracted = extractByLabels(block);
    const contentType = extracted['Content Type'] ?? '';
    const complexityValue =
      extracted['Clinical Complexity Level'] ??
      extracted['Clinical Complexity'] ??
      '';
    const sessionUseValue = extracted['Session Use'] ?? '';
    const evidenceValue = extracted['Evidence Strength'] ?? '';

    if (!contentType || !complexityValue || !sessionUseValue || !evidenceValue) {
      throw new Error(`Missing required metadata for tool "${toolTitle}" in ${volume.pdfPath}`);
    }

    const primaryClinicalDomains = splitList(
      extracted['Primary Clinical Domains'] ?? extracted['Primary Clinical Domain'],
    );
    const applicableModalities = splitList(extracted['Applicable Modalities']);
    const targetPopulation = splitList(extracted['Target Population']);
    const clinicalSetting = splitList(extracted['Clinical Setting']);
    const tags = splitList(extracted['Tags']);
    const culturalAccessibility = cleanValue(
      extracted['Cultural Accessibility & Neurodivergence'] ??
        extracted['Cultural Accessibility and Neurodivergence'] ??
        '',
    );
    const telehealthAdaptations = cleanValue(
      extracted['Telehealth & Digital Adaptations'] ??
        extracted['Telehealth and Digital Adaptations'] ??
        '',
    );
    const peerReviewStatement = cleanValue(extracted['Internal Peer Review Statement'] ?? '');
    const crisisGuidance = cleanValue(extracted['Crisis Guidance'] ?? '');
    const contraindications = splitList(extracted['Contraindications']);
    const cautions = splitList(extracted['Cautions']);

    if (!peerReviewStatement || !crisisGuidance) {
      throw new Error(`Missing required safety/peer review content for tool "${toolTitle}"`);
    }

    const toolHeaderStripRegex = /^\s*Tool\s+\d{1,2}\s*[:\-]\s*.+$/im;
    const body = stripMetadata(block.replace(toolHeaderStripRegex, ''));
    const sectionsRaw = splitSections(body);
    const sections: ParsedSection[] = [];
    const clientMaterials: ParsedClientMaterial[] = [];

    for (const section of sectionsRaw) {
      const materialType = detectClientMaterial(section.header);
      const chunks = chunkSectionText(section.text);
      if (materialType) {
        const title = section.header || 'Client Material';
        const clientId = `${toolId}-client-${slugify(title)}`;
        clientMaterials.push({
          id: clientId,
          toolId,
          materialType,
          title,
          text: section.text,
        });
        continue;
      }
      let chunkOrder = 1;
      for (const chunk of chunks) {
        const sectionId = `${toolId}-${slugify(section.header || 'body')}-${chunkOrder}`;
        sections.push({
          id: sectionId,
          toolId,
          sectionType: section.header || 'Body',
          text: chunk,
          chunkOrder,
        });
        chunkOrder += 1;
      }
    }

    tools.push({
      id: toolId,
      volumeId: volume.id,
      title: toolTitle,
      order: toolOrder,
      contentType,
      clinicalComplexityLevel: parseComplexity(complexityValue),
      sessionUse: parseSessionUse(sessionUseValue),
      evidenceStrength: parseEvidenceStrength(evidenceValue),
      primaryClinicalDomains,
      applicableModalities,
      targetPopulation,
      clinicalSetting,
      tags,
      culturalAccessibilityNeurodivergence: culturalAccessibility || null,
      telehealthDigitalAdaptations: telehealthAdaptations || null,
      internalPeerReviewStatement: peerReviewStatement,
      crisisGuidance,
      contraindications,
      cautions,
      pdfPath: volume.pdfPath,
      pageStart: null,
      pageEnd: null,
      sections,
      clientMaterials,
    });
  }

  return tools;
}

async function upsertLibrary(): Promise<void> {
  await prisma.library.upsert({
    where: { id: LIBRARY_ID },
    update: {
      title: 'Clinical Content Library – Complete Volume Set',
      version: '1.0.0',
      createdAt: new Date('2026-01-14'),
      intendedAudience: [
        'licensed_clinicians',
        'clinical_trainees',
        'supervisors',
        'allied_behavioral_health',
      ],
      distributionChannels: ['digital_therapy_platform', 'course_curriculum', 'app_content'],
    },
    create: {
      id: LIBRARY_ID,
      title: 'Clinical Content Library – Complete Volume Set',
      version: '1.0.0',
      createdAt: new Date('2026-01-14'),
      intendedAudience: [
        'licensed_clinicians',
        'clinical_trainees',
        'supervisors',
        'allied_behavioral_health',
      ],
      distributionChannels: ['digital_therapy_platform', 'course_curriculum', 'app_content'],
    },
  });
}

async function upsertVolume(volume: VolumeInput): Promise<void> {
  await prisma.volume.upsert({
    where: { id: volume.id },
    update: {
      libraryId: LIBRARY_ID,
      title: volume.title,
      order: volume.order,
    },
    create: {
      id: volume.id,
      libraryId: LIBRARY_ID,
      title: volume.title,
      order: volume.order,
    },
  });
}

async function upsertSourceFile(volume: VolumeInput): Promise<void> {
  const fileHash = sha256File(volume.pdfPath);
  const pageCount = tryGetPdfPageCount(volume.pdfPath);
  const sourceId = `source-${volume.id}-${fileHash ?? slugify(path.basename(volume.pdfPath))}`;

  await prisma.sourceFile.upsert({
    where: { id: sourceId },
    update: {
      volumeId: volume.id,
      type: 'pdf',
      path: volume.pdfPath,
      sha256: fileHash,
      pages: pageCount,
    },
    create: {
      id: sourceId,
      volumeId: volume.id,
      type: 'pdf',
      path: volume.pdfPath,
      sha256: fileHash,
      pages: pageCount,
    },
  });
}

async function upsertTool(tool: ParsedTool): Promise<void> {
  await prisma.tool.upsert({
    where: { id: tool.id },
    update: {
      volumeId: tool.volumeId,
      title: tool.title,
      order: tool.order,
      contentType: tool.contentType,
      clinicalComplexityLevel: tool.clinicalComplexityLevel,
      sessionUse: tool.sessionUse,
      evidenceStrength: tool.evidenceStrength,
      primaryClinicalDomains: tool.primaryClinicalDomains,
      applicableModalities: tool.applicableModalities,
      targetPopulation: tool.targetPopulation,
      clinicalSetting: tool.clinicalSetting,
      tags: tool.tags,
      culturalAccessibilityNeurodivergence: tool.culturalAccessibilityNeurodivergence,
      telehealthDigitalAdaptations: tool.telehealthDigitalAdaptations,
      internalPeerReviewStatement: tool.internalPeerReviewStatement,
      crisisGuidance: tool.crisisGuidance,
      contraindications: tool.contraindications,
      cautions: tool.cautions,
      pdfPath: tool.pdfPath,
      pageStart: tool.pageStart,
      pageEnd: tool.pageEnd,
    },
    create: {
      id: tool.id,
      volumeId: tool.volumeId,
      title: tool.title,
      order: tool.order,
      contentType: tool.contentType,
      clinicalComplexityLevel: tool.clinicalComplexityLevel,
      sessionUse: tool.sessionUse,
      evidenceStrength: tool.evidenceStrength,
      primaryClinicalDomains: tool.primaryClinicalDomains,
      applicableModalities: tool.applicableModalities,
      targetPopulation: tool.targetPopulation,
      clinicalSetting: tool.clinicalSetting,
      tags: tool.tags,
      culturalAccessibilityNeurodivergence: tool.culturalAccessibilityNeurodivergence,
      telehealthDigitalAdaptations: tool.telehealthDigitalAdaptations,
      internalPeerReviewStatement: tool.internalPeerReviewStatement,
      crisisGuidance: tool.crisisGuidance,
      contraindications: tool.contraindications,
      cautions: tool.cautions,
      pdfPath: tool.pdfPath,
      pageStart: tool.pageStart,
      pageEnd: tool.pageEnd,
    },
  });

  await prisma.section.deleteMany({ where: { toolId: tool.id } });
  await prisma.clientMaterial.deleteMany({ where: { toolId: tool.id } });

  if (tool.sections.length) {
    await prisma.section.createMany({
      data: tool.sections.map((section) => ({
        id: section.id,
        toolId: section.toolId,
        sectionType: section.sectionType,
        audience: 'Therapist',
        contentFormat: 'markdown',
        text: section.text,
        chunkOrder: section.chunkOrder,
      })),
    });
  }

  if (tool.clientMaterials.length) {
    await prisma.clientMaterial.createMany({
      data: tool.clientMaterials.map((material) => ({
        id: material.id,
        toolId: material.toolId,
        materialType: material.materialType,
        title: material.title,
        contentFormat: 'markdown',
        text: material.text,
        deliveryChannels: ['in_session', 'between_session'],
        printable: true,
        mobileFriendly: true,
      })),
    });
  }
}

async function ingestVolume(volume: VolumeInput): Promise<void> {
  await upsertVolume(volume);
  await upsertSourceFile(volume);
  const tools = parseToolsFromPdf(volume);
  for (const tool of tools) {
    await upsertTool(tool);
  }
}

async function main(): Promise<void> {
  await upsertLibrary();
  for (const volume of VOLUME_INPUTS) {
    await ingestVolume(volume);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
