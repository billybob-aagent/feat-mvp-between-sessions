import { Inject, Injectable, Optional } from "@nestjs/common";
import { AiPurpose, UserRole } from "@prisma/client";
import { AiSafetyGatewayService } from "../ai-safety-gateway/ai-safety-gateway.service";
import { buildAdherencePrompt } from "./prompts/adherence.prompt";
import { buildAssessmentPrompt } from "./prompts/assessment.prompt";
import { ADHERENCE_RESPONSE_SCHEMA } from "./schemas/adherence.schema";
import { ASSESSMENT_RESPONSE_SCHEMA } from "./schemas/assessment.schema";
import { LlmProvider } from "./providers/llm-provider.interface";
import { MockProvider } from "./providers/mock.provider";
import { OpenAiProvider } from "./providers/openai.provider";
import { RetrievalService } from "./retrieval/retrieval.service";
import { ADHERENCE_DISCLAIMER, ASSESSMENT_DISCLAIMER, NO_SOURCES_NOTICE } from "./utils/disclaimers";

const DEFAULT_SNIPPET_LENGTH = 160;
const MAX_SOURCES = 5;

type AdherenceAssistPayload = {
  clinicId: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  completion_criteria: string;
  client_response: string;
  context?: { assignment_title?: string | null; program?: string | null } | null;
};

type AssessmentAssistPayload = {
  clinicId: string;
  clientId: string;
  assessment_type: string;
  inputs: Record<string, any>;
  note?: string | null;
};

type AdherenceAssistContent = {
  criteria_match: "MET" | "PARTIAL" | "NOT_MET" | "UNCLEAR";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence_snippets: { text: string; reason: string }[];
  missing_elements: string[];
  suggested_clinician_feedback_draft: string;
};

type AssessmentAssistContent = {
  draft_sections: { title: string; content: string }[];
  gaps_questions: string[];
  evidence_mapping: { input_key: string; used_in_section: string }[];
};

@Injectable()
export class AiAssistService {
  private provider: LlmProvider;

  constructor(
    private gateway: AiSafetyGatewayService,
    private retrieval: RetrievalService,
    @Optional() @Inject("LLM_PROVIDER") provider?: LlmProvider,
  ) {
    this.provider = provider ?? this.createProvider();
  }

  private createProvider(): LlmProvider {
    const selected = String(process.env.AI_PROVIDER ?? "mock").toLowerCase();
    if (selected === "openai") {
      return new OpenAiProvider(process.env.OPENAI_API_KEY);
    }
    return new MockProvider();
  }

  async adherenceAssist(params: {
    userId: string;
    role: UserRole;
    payload: AdherenceAssistPayload;
  }) {
    const processed = await this.gateway.processRequest({
      clinicId: params.payload.clinicId,
      userId: params.userId,
      role: params.role,
      purpose: AiPurpose.ADHERENCE_REVIEW,
      payload: params.payload,
    });

    if (!processed.allowed) {
      return {
        ok: false,
        denial_reason: processed.denialReason ?? "AI_DISABLED",
        sanitized_hash: processed.sanitizedHash,
        redaction_stats: processed.redactionStats,
      };
    }

    const sanitizedPayload = processed.sanitizedPayload as AdherenceAssistPayload;
    const retrievalSources = await this.safeRetrieveSources({
      clinicId: sanitizedPayload.clinicId,
      query: sanitizedPayload.completion_criteria,
      limit: MAX_SOURCES,
    });
    const sourcesUsed = retrievalSources.sourceItemIds;

    const prompt = buildAdherencePrompt({
      payload: {
        completion_criteria: sanitizedPayload.completion_criteria,
        client_response: sanitizedPayload.client_response,
        context: sanitizedPayload.context ?? null,
        periodStart: sanitizedPayload.periodStart,
        periodEnd: sanitizedPayload.periodEnd,
        clientId: sanitizedPayload.clientId,
      },
      sources: retrievalSources.sources,
      schema: ADHERENCE_RESPONSE_SCHEMA,
    });

    const content = await this.provider.generateStructured<AdherenceAssistContent>({
      purpose: AiPurpose.ADHERENCE_REVIEW,
      prompt,
      schema: ADHERENCE_RESPONSE_SCHEMA,
      temperature: 0,
      maxTokens: 512,
    });

    const normalized = this.normalizeAdherenceContent({
      content,
      responseText: sanitizedPayload.client_response,
      sourcesUsed,
    });

    return {
      assistant: "LLM-1_ADHERENCE_EVIDENCE",
      version: "v1",
      disclaimer: ADHERENCE_DISCLAIMER,
      ...normalized,
      sources_used: sourcesUsed,
      sanitized_hash: processed.sanitizedHash,
      redaction_stats: processed.redactionStats,
    };
  }

  async assessmentAssist(params: {
    userId: string;
    role: UserRole;
    payload: AssessmentAssistPayload;
  }) {
    const processed = await this.gateway.processRequest({
      clinicId: params.payload.clinicId,
      userId: params.userId,
      role: params.role,
      purpose: AiPurpose.DOCUMENTATION,
      payload: params.payload,
    });

    if (!processed.allowed) {
      return {
        ok: false,
        denial_reason: processed.denialReason ?? "AI_DISABLED",
        sanitized_hash: processed.sanitizedHash,
        redaction_stats: processed.redactionStats,
      };
    }

    const sanitizedPayload = processed.sanitizedPayload as AssessmentAssistPayload;
    const retrievalSources = await this.safeRetrieveSources({
      clinicId: sanitizedPayload.clinicId,
      query: this.buildAssessmentQuery(sanitizedPayload),
      limit: 3,
    });
    const sourcesUsed = retrievalSources.sourceItemIds;

    const prompt = buildAssessmentPrompt({
      payload: {
        assessment_type: sanitizedPayload.assessment_type,
        inputs: sanitizedPayload.inputs ?? {},
        note: sanitizedPayload.note ?? null,
        clientId: sanitizedPayload.clientId,
      },
      sources: retrievalSources.sources,
      schema: ASSESSMENT_RESPONSE_SCHEMA,
    });

    const content = await this.provider.generateStructured<AssessmentAssistContent>({
      purpose: AiPurpose.DOCUMENTATION,
      prompt,
      schema: ASSESSMENT_RESPONSE_SCHEMA,
      temperature: 0,
      maxTokens: 768,
    });

    const normalized = this.normalizeAssessmentContent({
      content,
      sourcesUsed,
    });

    return {
      assistant: "LLM-2_ASSESSMENT_DRAFT",
      version: "v1",
      disclaimer: ASSESSMENT_DISCLAIMER,
      ...normalized,
      sources_used: sourcesUsed,
      sanitized_hash: processed.sanitizedHash,
      redaction_stats: processed.redactionStats,
    };
  }

  private buildAssessmentQuery(payload: AssessmentAssistPayload) {
    const keys = Object.keys(payload.inputs ?? {});
    const base = `${payload.assessment_type ?? ""} ${keys.join(" ")}`.trim();
    return base || payload.assessment_type || "";
  }

  private async safeRetrieveSources(params: { clinicId: string; query: string; limit: number }) {
    try {
      return await this.retrieval.retrieveApprovedSources(params);
    } catch {
      return { sources: [], sourceItemIds: [] };
    }
  }

  private normalizeAdherenceContent(params: {
    content: AdherenceAssistContent;
    responseText: string;
    sourcesUsed: string[];
  }): AdherenceAssistContent {
    const response = params.responseText ?? "";
    const sourcesUsed = params.sourcesUsed;
    const snippets = this.normalizeEvidenceSnippets(
      params.content.evidence_snippets ?? [],
      response,
      sourcesUsed,
    );

    let missingElements = params.content.missing_elements ?? [];
    if (sourcesUsed.length === 0 && !missingElements.includes(NO_SOURCES_NOTICE)) {
      missingElements = [NO_SOURCES_NOTICE, ...missingElements];
    }

    let feedback = params.content.suggested_clinician_feedback_draft ?? "";
    if (sourcesUsed.length === 0 && !feedback.toLowerCase().includes(NO_SOURCES_NOTICE.toLowerCase())) {
      feedback = `${NO_SOURCES_NOTICE} ${feedback}`.trim();
    }

    const allowedCriteria = new Set(["MET", "PARTIAL", "NOT_MET", "UNCLEAR"]);
    const allowedConfidence = new Set(["LOW", "MEDIUM", "HIGH"]);
    const criteriaMatch = allowedCriteria.has(params.content.criteria_match)
      ? params.content.criteria_match
      : "UNCLEAR";
    const confidence = allowedConfidence.has(params.content.confidence)
      ? params.content.confidence
      : "LOW";

    return {
      criteria_match: criteriaMatch,
      confidence,
      evidence_snippets: snippets,
      missing_elements: missingElements,
      suggested_clinician_feedback_draft: feedback,
    };
  }

  private normalizeEvidenceSnippets(
    snippets: { text: string; reason: string; source_ids?: string[] }[],
    responseText: string,
    sourcesUsed: string[],
  ) {
    if (!responseText.trim()) return [];

    const fallbackSnippet = responseText.slice(0, DEFAULT_SNIPPET_LENGTH).trim();
    const trimmedSnippets = snippets.length > 0 ? snippets : [{ text: fallbackSnippet, reason: "Supports criteria" }];

    const normalized = trimmedSnippets.map((snippet) => {
      const text = responseText.includes(snippet.text) ? snippet.text : fallbackSnippet;
      return {
        text,
        reason: snippet.reason || "Supports criteria",
        source_ids: snippet.source_ids?.length ? snippet.source_ids : sourcesUsed.slice(0, 1),
        index: responseText.indexOf(text),
      };
    });

    normalized.sort((a, b) => {
      const aIndex = a.index;
      const bIndex = b.index;
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return normalized.map(({ index, ...rest }) => rest);
  }

  private normalizeAssessmentContent(params: {
    content: AssessmentAssistContent;
    sourcesUsed: string[];
  }): AssessmentAssistContent {
    const draftSections = params.content.draft_sections ?? [];
    const gaps = params.content.gaps_questions ?? [];
    const mapping = params.content.evidence_mapping ?? [];
    const sourcesUsed = params.sourcesUsed;

    if (sourcesUsed.length === 0 && !gaps.includes(NO_SOURCES_NOTICE)) {
      gaps.push(NO_SOURCES_NOTICE);
    }

    return {
      draft_sections: draftSections,
      gaps_questions: gaps,
      evidence_mapping: mapping,
    };
  }
}
