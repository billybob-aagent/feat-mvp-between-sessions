import { createHash } from "crypto";
import { LlmGenerateInput, LlmProvider } from "./llm-provider.interface";
import { extractKeywords } from "../utils/determinism";
import { NO_SOURCES_NOTICE } from "../utils/disclaimers";

const extractPayload = (prompt: string) => {
  const match = prompt.match(/<SANITIZED_PAYLOAD>([\s\S]*?)<\/SANITIZED_PAYLOAD>/);
  if (!match) return {};
  const raw = match[1].trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const extractSources = (prompt: string) => {
  const match = prompt.match(/<RETRIEVED_SOURCES>([\s\S]*?)<\/RETRIEVED_SOURCES>/);
  if (!match) return [] as Array<{ id: string; itemId: string; title: string; headingPath: string; text: string }>;
  const raw = match[1].trim();
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const extractPurpose = (prompt: string) => {
  const match = prompt.match(/PURPOSE:\s*([A-Z0-9_]+)/i);
  return match ? match[1].trim() : "";
};

const hashSeed = (input: string) =>
  parseInt(createHash("sha256").update(input).digest("hex").slice(0, 8), 16);

const pickFrom = <T>(items: T[], seed: number) => items[seed % items.length];

const buildEvidenceSnippets = (response: string, keywords: string[]) => {
  if (!response.trim()) return [] as { text: string; reason: string }[];
  const sentences = response.split(/(?<=[.!?])\s+/);
  const snippets: { text: string; reason: string }[] = [];
  for (const sentence of sentences) {
    const lowered = sentence.toLowerCase();
    const matched = keywords.find((keyword) => lowered.includes(keyword));
    if (matched) {
      snippets.push({
        text: sentence.trim().slice(0, 160),
        reason: `Mentions ${matched}`,
      });
    }
    if (snippets.length >= 3) break;
  }

  if (snippets.length === 0) {
    snippets.push({
      text: response.trim().slice(0, 160),
      reason: "Addresses criteria",
    });
  }

  return snippets;
};

const buildSourcesUsed = (sources: any[]) => {
  const ids: string[] = [];
  for (const source of sources) {
    const id = source?.itemId;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
};

const buildAdherenceResult = (payload: any, seed: number, sources: any[]) => {
  const criteria = String(payload?.completion_criteria ?? "");
  const response = String(payload?.client_response ?? "");
  const sourcesUsed = buildSourcesUsed(sources);

  if (!response.trim()) {
    return {
      criteria_match: "UNCLEAR",
      confidence: "LOW",
      evidence_snippets: [],
      missing_elements: [
        "Client response not provided",
        ...(sourcesUsed.length === 0 ? [NO_SOURCES_NOTICE] : []),
      ],
      suggested_clinician_feedback_draft:
        `${sourcesUsed.length === 0 ? `${NO_SOURCES_NOTICE} ` : ""}Please provide a response addressing the completion criteria.`.trim(),
      sources_used: sourcesUsed,
    };
  }

  const keywords = extractKeywords(criteria).slice(0, 8);
  const responseLower = response.toLowerCase();
  const matched = keywords.filter((keyword) => responseLower.includes(keyword));

  let criteriaMatch: "MET" | "PARTIAL" | "NOT_MET" | "UNCLEAR" = "NOT_MET";
  if (matched.length >= 2) criteriaMatch = "MET";
  else if (matched.length === 1) criteriaMatch = "PARTIAL";
  else criteriaMatch = "NOT_MET";

  const confidence =
    criteriaMatch === "MET" && response.length > 80
      ? "HIGH"
      : criteriaMatch === "MET" || criteriaMatch === "PARTIAL"
        ? "MEDIUM"
        : "LOW";

  const evidenceSnippets = buildEvidenceSnippets(response, keywords).map((snippet) => ({
    ...snippet,
    source_ids: sourcesUsed.slice(0, 1),
  }));

  const missing = keywords.filter((keyword) => !responseLower.includes(keyword));
  let missingElements =
    criteriaMatch === "MET" ? [] : missing.length > 0 ? missing : ["More detail needed"];
  if (sourcesUsed.length === 0 && !missingElements.includes(NO_SOURCES_NOTICE)) {
    missingElements = [NO_SOURCES_NOTICE, ...missingElements];
  }

  const positiveTemplates = [
    "Thank you for the update. I see you described {details}. We'll review this in session.",
    "Appreciate the update. You noted {details}. We'll discuss together in session.",
  ];

  const requestTemplates = [
    "Thanks for sharing. Please add detail on {details}.",
    "Please provide more detail on {details} to address the criteria.",
  ];

  const details = matched.length > 0 ? matched.slice(0, 2).join(" and ") : "your response";
  const missingDetails = missingElements.length > 0 ? missingElements.slice(0, 2).join(" and ") : "the criteria";

  const suggestedTemplate =
    criteriaMatch === "MET"
      ? pickFrom(positiveTemplates, seed)
      : pickFrom(requestTemplates, seed);

  const suggested = suggestedTemplate
    .replace("{details}", criteriaMatch === "MET" ? details : missingDetails)
    .trim();

  return {
    criteria_match: criteriaMatch,
    confidence,
    evidence_snippets: evidenceSnippets,
    missing_elements: missingElements,
    suggested_clinician_feedback_draft:
      sourcesUsed.length === 0 ? `${NO_SOURCES_NOTICE} ${suggested}`.trim() : suggested,
    sources_used: sourcesUsed,
  };
};

const buildAssessmentResult = (payload: any, sources: any[]) => {
  const assessmentType = String(payload?.assessment_type ?? "OTHER").toUpperCase();
  const inputs: Record<string, any> = payload?.inputs && typeof payload.inputs === "object" ? payload.inputs : {};
  const note = payload?.note ?? null;
  const sourcesUsed = buildSourcesUsed(sources);

  const draft_sections: { title: string; content: string }[] = [];
  const gaps_questions: string[] = [];
  const evidence_mapping: { input_key: string; used_in_section: string }[] = [];

  if (assessmentType === "ASAM") {
    const dimensions = ["D1", "D2", "D3", "D4", "D5", "D6"];
    for (const dim of dimensions) {
      const title = `Dimension ${dim.slice(1)} (${dim})`;
      const value = inputs[dim];
      if (value === undefined || value === null || String(value).trim() === "") {
        draft_sections.push({ title, content: "Not provided." });
        gaps_questions.push(`Provide details for ${dim}.`);
      } else {
        draft_sections.push({ title, content: String(value) });
        evidence_mapping.push({ input_key: dim, used_in_section: title });
      }
    }
  } else {
    const keys = Object.keys(inputs).sort();
    if (keys.length === 0) {
      draft_sections.push({ title: "Draft", content: "No input provided." });
      gaps_questions.push("Provide assessment inputs.");
    } else {
      for (const key of keys) {
        const title = key;
        const value = inputs[key];
        draft_sections.push({ title, content: String(value) });
        evidence_mapping.push({ input_key: key, used_in_section: title });
      }
    }
  }

  if (note) {
    draft_sections.push({ title: "Note", content: String(note) });
  }

  if (sourcesUsed.length === 0) {
    draft_sections.push({ title: "Sources", content: NO_SOURCES_NOTICE });
    gaps_questions.push(NO_SOURCES_NOTICE);
  } else {
    const titles = sources.map((source) => source.title).filter(Boolean);
    draft_sections.push({
      title: "Sources",
      content: `Approved sources used: ${Array.from(new Set(titles)).join("; ")}`,
    });
  }

  if (draft_sections.length > 0) {
    draft_sections.push({
      title: "Summary",
      content: "Draft summary compiled from provided inputs. Clinician review required.",
    });
  }

  return { draft_sections, gaps_questions, evidence_mapping, sources_used: sourcesUsed };
};

const buildDraftResult = (payload: any, label: string) => {
  const evidenceRefs = Array.isArray(payload?.evidence_refs) ? payload.evidence_refs : [];
  const snippet = evidenceRefs.length > 0 ? evidenceRefs.slice(0, 2).join("; ") : "reviewed evidence";
  return {
    text: `Draft ${label} based on ${snippet}.`,
    evidence_refs: evidenceRefs,
  };
};

const buildFeedbackDraft = (payload: any) => {
  const assignment = payload?.assignment_title || "the assignment";
  const date = payload?.response_date || "the response date";
  return {
    text: `Thank you for completing ${assignment} on ${date}. Please add any helpful details for follow-up in session.`,
    evidence_refs: Array.isArray(payload?.evidence_refs) ? payload.evidence_refs : [],
  };
};

export class MockProvider implements LlmProvider {
  async generateStructured<T>(input: LlmGenerateInput): Promise<T> {
    const payload = extractPayload(input.prompt);
    const seed = hashSeed(input.prompt);
    const sources = extractSources(input.prompt);
    const purposeLabel = extractPurpose(input.prompt).toUpperCase();

    if (purposeLabel === "ADHERENCE_FEEDBACK_DRAFT") {
      return buildFeedbackDraft(payload) as T;
    }

    if (purposeLabel === "CLIENT_PROGRESS_SUMMARY_DRAFT") {
      return buildDraftResult(payload, "progress summary") as T;
    }

    if (purposeLabel === "SUPERVISOR_SUMMARY_DRAFT") {
      return buildDraftResult(payload, "supervisor summary") as T;
    }

    if (String(input.purpose).toUpperCase() === "ADHERENCE_REVIEW") {
      return buildAdherenceResult(payload, seed, sources) as T;
    }

    return buildAssessmentResult(payload, sources) as T;
  }
}
