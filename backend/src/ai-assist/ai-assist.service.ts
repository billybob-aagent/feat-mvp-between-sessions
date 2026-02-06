import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AiPurpose, SupervisorEscalationStatus, UserRole } from "@prisma/client";
import { AiSafetyGatewayService } from "../ai-safety-gateway/ai-safety-gateway.service";
import { PrismaService } from "../modules/prisma/prisma.service";
import { AesGcm } from "../common/crypto/aes-gcm";
import { buildAdherencePrompt } from "./prompts/adherence.prompt";
import { buildAssessmentPrompt } from "./prompts/assessment.prompt";
import { buildDraftPrompt } from "./prompts/draft.prompt";
import { ADHERENCE_RESPONSE_SCHEMA } from "./schemas/adherence.schema";
import { ASSESSMENT_RESPONSE_SCHEMA } from "./schemas/assessment.schema";
import { DRAFT_RESPONSE_SCHEMA } from "./schemas/draft.schema";
import { LlmGenerateInput, LlmProvider } from "./providers/llm-provider.interface";
import { MockProvider } from "./providers/mock.provider";
import { OpenAiProvider } from "./providers/openai.provider";
import { RetrievalService } from "./retrieval/retrieval.service";
import {
  ADHERENCE_DISCLAIMER,
  ASSESSMENT_DISCLAIMER,
  DRAFT_ONLY_DISCLAIMER,
  NO_SOURCES_NOTICE,
} from "./utils/disclaimers";
import {
  buildDateRangeFromParts,
  buildStorageDateFromParts,
  dateOnlyPartsFromUTC,
  formatDateOnly,
  parseDateOnly,
  toDateOnlyStringLocal,
} from "../reports/aer/aer-report.utils";

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

type ProgressSummaryPayload = {
  clinicId: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
};

type SupervisorSummaryPayload = {
  clinicId: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
};

type AdherenceFeedbackPayload = {
  clinicId: string;
  responseId: string;
};

type DraftContent = {
  text: string;
  evidence_refs: string[];
};

type ReviewedResponseEvidence = {
  id: string;
  assignmentId: string;
  assignmentTitle: string | null;
  assignmentPrompt: string | null;
  createdAt: Date;
  reviewedAt: Date;
  mood: number;
  text: string;
  nameRedactionCount: number;
};

type EvidencePreviewItem = {
  assignment_title: string | null;
  response_date: string;
  reviewed_at: string;
  completion_status: "reviewed";
};

type EvidencePreview = {
  reviewed_response_count: number;
  items: EvidencePreviewItem[];
};

@Injectable()
export class AiAssistService {
  private provider: LlmProvider;

  constructor(
    private gateway: AiSafetyGatewayService,
    private retrieval: RetrievalService,
    private prisma: PrismaService,
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

    const content = await this.generateStructuredOrThrow<AdherenceAssistContent>({
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

    const content = await this.generateStructuredOrThrow<AssessmentAssistContent>({
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

  async progressSummaryPreview(params: {
    userId: string;
    role: UserRole;
    payload: ProgressSummaryPayload;
  }): Promise<EvidencePreview> {
    const { clinicId, clientId, periodStart, periodEnd } = params.payload;
    const range = this.parseDateRangeOrThrow(periodStart, periodEnd);

    const client = await this.ensureClientAccess({
      userId: params.userId,
      role: params.role,
      clinicId,
      clientId,
    });

    const nameAllowlist = this.buildNameAllowlist({
      clientName: client.full_name,
      therapistName: client.therapist?.full_name,
    });

    return this.fetchEvidencePreview({
      clinicId,
      clientId,
      start: range.start,
      end: range.end,
      nameAllowlist,
    });
  }

  async supervisorSummaryPreview(params: {
    userId: string;
    role: UserRole;
    payload: SupervisorSummaryPayload;
  }): Promise<EvidencePreview> {
    const { clinicId, clientId, periodStart, periodEnd } = params.payload;
    const range = this.parseDateRangeOrThrow(periodStart, periodEnd);

    const client = await this.ensureClientAccess({
      userId: params.userId,
      role: params.role,
      clinicId,
      clientId,
    });

    const nameAllowlist = this.buildNameAllowlist({
      clientName: client.full_name,
      therapistName: client.therapist?.full_name,
    });

    return this.fetchEvidencePreview({
      clinicId,
      clientId,
      start: range.start,
      end: range.end,
      nameAllowlist,
    });
  }

  async progressSummaryDraft(params: {
    userId: string;
    role: UserRole;
    payload: ProgressSummaryPayload;
  }) {
    const { clinicId, clientId, periodStart, periodEnd } = params.payload;
    const range = this.parseDateRangeOrThrow(periodStart, periodEnd);

    const client = await this.ensureClientAccess({
      userId: params.userId,
      role: params.role,
      clinicId,
      clientId,
    });

    const nameAllowlist = this.buildNameAllowlist({
      clientName: client.full_name,
      therapistName: client.therapist?.full_name,
    });

    const [reviewedResponses, assignments] = await Promise.all([
      this.fetchReviewedResponses({
        clinicId,
        clientId,
        start: range.start,
        end: range.end,
        nameAllowlist,
      }),
      this.fetchAssignments({ clinicId, clientId, start: range.start, end: range.end }),
    ]);

    if (reviewedResponses.length === 0) {
      throw new BadRequestException("no_reviewed_evidence");
    }

    const evidenceRefsResult = this.buildEvidenceRefs(reviewedResponses, nameAllowlist);
    const applyTargetResponseId = this.pickApplyTargetResponseId(reviewedResponses);

    let nameRedactionCount = reviewedResponses.reduce(
      (sum, response) => sum + response.nameRedactionCount,
      0,
    );
    nameRedactionCount += evidenceRefsResult.nameRedactionCount;

    const assignmentSummaryResult = this.buildAssignmentSummaries(
      assignments,
      reviewedResponses,
      nameAllowlist,
    );
    nameRedactionCount += assignmentSummaryResult.nameRedactionCount;

    const payload = {
      clinicId,
      clientId,
      period: { start: periodStart, end: periodEnd },
      assignments: assignmentSummaryResult.items,
      reviewed_responses: reviewedResponses.map((response) => {
        const title = response.assignmentTitle ?? null;
        const redactedTitle = title
          ? this.redactAllowlistedNames(title, nameAllowlist)
          : { text: null, count: 0 };
        nameRedactionCount += redactedTitle.count;
        return {
          assignment_title: redactedTitle.text,
          response_date: toDateOnlyStringLocal(response.createdAt),
          reviewed_at: toDateOnlyStringLocal(response.reviewedAt),
          mood: response.mood,
          response_text: response.text,
        };
      }),
      evidence_refs: evidenceRefsResult.refs,
    };

    const result = await this.generateDraft({
      userId: params.userId,
      role: params.role,
      clinicId,
      purpose: AiPurpose.DOCUMENTATION,
      promptPurpose: "CLIENT_PROGRESS_SUMMARY_DRAFT",
      promptVersion: "1",
      assistant: "LLM-3_PROGRESS_SUMMARY_DRAFT",
      payload,
      evidenceRefs: evidenceRefsResult.refs,
      nameRedactionCount,
      instructions: [
        "TASK: Draft a neutral client progress summary for clinician review.",
        "Use reviewed evidence only and cite evidence by assignment title + date (no IDs).",
        "Focus on completed work and observable patterns; avoid diagnoses or recommendations.",
      ],
    });

    if (result.ok === false) return result;

    return {
      ...result,
      apply_target_response_id: applyTargetResponseId,
    };
  }

  async supervisorSummaryDraft(params: {
    userId: string;
    role: UserRole;
    payload: SupervisorSummaryPayload;
  }) {
    const { clinicId, clientId, periodStart, periodEnd } = params.payload;
    const range = this.parseDateRangeOrThrow(periodStart, periodEnd);

    const client = await this.ensureClientAccess({
      userId: params.userId,
      role: params.role,
      clinicId,
      clientId,
    });

    const nameAllowlist = this.buildNameAllowlist({
      clientName: client.full_name,
      therapistName: client.therapist?.full_name,
    });

    const [reviewedResponses, assignments, escalation] = await Promise.all([
      this.fetchReviewedResponses({
        clinicId,
        clientId,
        start: range.start,
        end: range.end,
        nameAllowlist,
      }),
      this.fetchAssignments({ clinicId, clientId, start: range.start, end: range.end }),
      this.fetchEscalationContext({ clinicId, clientId, periodStart, periodEnd }),
    ]);

    if (reviewedResponses.length === 0) {
      throw new BadRequestException("no_reviewed_evidence");
    }

    const evidenceRefsResult = this.buildEvidenceRefs(reviewedResponses, nameAllowlist);
    const applyTargetEscalationId =
      escalation?.status === SupervisorEscalationStatus.OPEN ? escalation.id : null;

    let nameRedactionCount = reviewedResponses.reduce(
      (sum, response) => sum + response.nameRedactionCount,
      0,
    );
    nameRedactionCount += evidenceRefsResult.nameRedactionCount;

    const assignmentSummaryResult = this.buildAssignmentSummaries(
      assignments,
      reviewedResponses,
      nameAllowlist,
    );
    nameRedactionCount += assignmentSummaryResult.nameRedactionCount;

    const payload = {
      clinicId,
      clientId,
      period: { start: periodStart, end: periodEnd },
      escalation_state: escalation
        ? {
            status: escalation.status,
            reason: escalation.reason,
            period_start: escalation.periodStart,
            period_end: escalation.periodEnd,
          }
        : { status: "NONE" },
      assignments: assignmentSummaryResult.items,
      reviewed_responses: reviewedResponses.map((response) => {
        const title = response.assignmentTitle ?? null;
        const redactedTitle = title
          ? this.redactAllowlistedNames(title, nameAllowlist)
          : { text: null, count: 0 };
        nameRedactionCount += redactedTitle.count;
        return {
          assignment_title: redactedTitle.text,
          response_date: toDateOnlyStringLocal(response.createdAt),
          reviewed_at: toDateOnlyStringLocal(response.reviewedAt),
          mood: response.mood,
          response_text: response.text,
        };
      }),
      evidence_refs: evidenceRefsResult.refs,
    };

    const result = await this.generateDraft({
      userId: params.userId,
      role: params.role,
      clinicId,
      purpose: AiPurpose.SUPERVISOR_SUMMARY,
      promptPurpose: "SUPERVISOR_SUMMARY_DRAFT",
      promptVersion: "1",
      assistant: "LLM-4_SUPERVISOR_SUMMARY_DRAFT",
      payload,
      evidenceRefs: evidenceRefsResult.refs,
      nameRedactionCount,
      instructions: [
        "TASK: Draft a concise supervisor oversight summary for clinician review.",
        "Use reviewed evidence only and cite evidence by assignment title + date (no IDs).",
        "Include escalation context if present. Avoid diagnoses or recommendations.",
      ],
    });

    if (result.ok === false) return result;

    return {
      ...result,
      escalation,
      apply_target_escalation_id: applyTargetEscalationId,
    };
  }

  async adherenceFeedbackDraft(params: {
    userId: string;
    role: UserRole;
    payload: AdherenceFeedbackPayload;
  }) {
    const { clinicId, responseId } = params.payload;

    const response = await this.ensureResponseAccess({
      userId: params.userId,
      role: params.role,
      clinicId,
      responseId,
    });

    if (!response.reviewed_at) {
      throw new BadRequestException("response_not_reviewed");
    }

    const assignmentTitle =
      response.assignment?.title ?? response.assignment?.prompt?.title ?? "Assignment";
    const assignmentPrompt = response.assignment?.prompt?.content ?? null;
    const responseTextRaw = this.decryptResponse(response);
    const nameAllowlist = this.buildNameAllowlist({
      clientName: response.client?.full_name,
      therapistName: response.assignment?.therapist?.full_name,
    });
    let nameRedactionCount = 0;
    const redactedResponse =
      nameAllowlist.length > 0
        ? this.redactAllowlistedNames(responseTextRaw, nameAllowlist)
        : { text: responseTextRaw, count: 0 };
    nameRedactionCount += redactedResponse.count;

    const evidenceRefRaw = `${assignmentTitle} — ${toDateOnlyStringLocal(response.created_at)}`;
    const evidenceRefRedacted =
      nameAllowlist.length > 0
        ? this.redactAllowlistedNames(evidenceRefRaw, nameAllowlist)
        : { text: evidenceRefRaw, count: 0 };
    nameRedactionCount += evidenceRefRedacted.count;

    const redactedTitle =
      nameAllowlist.length > 0
        ? this.redactAllowlistedNames(assignmentTitle, nameAllowlist)
        : { text: assignmentTitle, count: 0 };
    nameRedactionCount += redactedTitle.count;

    const redactedPrompt =
      assignmentPrompt && nameAllowlist.length > 0
        ? this.redactAllowlistedNames(assignmentPrompt, nameAllowlist)
        : { text: assignmentPrompt, count: 0 };
    nameRedactionCount += redactedPrompt.count;

    const payload = {
      clinicId,
      response_date: toDateOnlyStringLocal(response.created_at),
      assignment_title: redactedTitle.text,
      assignment_prompt: redactedPrompt.text,
      response_text: redactedResponse.text,
      evidence_refs: [evidenceRefRedacted.text],
    };

    const result = await this.generateDraft({
      userId: params.userId,
      role: params.role,
      clinicId,
      purpose: AiPurpose.ADHERENCE_REVIEW,
      promptPurpose: "ADHERENCE_FEEDBACK_DRAFT",
      promptVersion: "1",
      assistant: "LLM-5_ADHERENCE_FEEDBACK_DRAFT",
      payload,
      evidenceRefs: [evidenceRefRedacted.text],
      nameRedactionCount,
      instructions: [
        "TASK: Draft clinician feedback for a single reviewed response.",
        "Be factual and neutral; request clarification when needed.",
        "Cite the assignment title + response date in the text (no IDs).",
        "Do not diagnose, score, or recommend treatment.",
      ],
    });

    if (result.ok === false) return result;

    return {
      ...result,
      response_id: response.id,
      apply_target_response_id: response.id,
    };
  }

  private buildAssessmentQuery(payload: AssessmentAssistPayload) {
    const keys = Object.keys(payload.inputs ?? {});
    const base = `${payload.assessment_type ?? ""} ${keys.join(" ")}`.trim();
    return base || payload.assessment_type || "";
  }

  private parseDateOnlyOrThrow(value: string, label: string) {
    const trimmed = value.trim();
    const parts = parseDateOnly(trimmed);
    if (!parts) {
      throw new BadRequestException(`Invalid ${label} date format (expected YYYY-MM-DD)`);
    }
    return parts;
  }

  private parseDateRangeOrThrow(start: string, end: string) {
    const startParts = this.parseDateOnlyOrThrow(start, "periodStart");
    const endParts = this.parseDateOnlyOrThrow(end, "periodEnd");
    const startRange = buildDateRangeFromParts(startParts);
    const endRange = buildDateRangeFromParts(endParts);
    if (startRange.start > endRange.end) {
      throw new BadRequestException("periodStart must be before periodEnd");
    }
    return { start: startRange.start, end: endRange.end, startParts, endParts };
  }

  private async ensureClinicAccess(params: { userId: string; role: UserRole; clinicId: string }) {
    if (params.role === UserRole.admin) return;
    const membership = await this.prisma.clinic_memberships.findFirst({
      where: { user_id: params.userId, clinic_id: params.clinicId },
    });
    if (!membership) {
      throw new ForbiddenException("Clinic membership required");
    }
  }

  private async ensureClientAccess(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    clientId: string;
  }) {
    const client = await this.prisma.clients.findUnique({
      where: { id: params.clientId },
      select: {
        id: true,
        full_name: true,
        therapist_id: true,
        therapist: { select: { clinic_id: true, user_id: true, full_name: true } },
      },
    });
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    if (client.therapist?.clinic_id !== params.clinicId) {
      throw new ForbiddenException("Client does not belong to clinic");
    }

    if (params.role === UserRole.therapist) {
      const therapist = await this.prisma.therapists.findFirst({
        where: { user_id: params.userId },
        select: { id: true },
      });
      if (!therapist || therapist.id !== client.therapist_id) {
        throw new ForbiddenException("Not your client");
      }
      return client;
    }

    await this.ensureClinicAccess(params);
    return client;
  }

  private async ensureResponseAccess(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    responseId: string;
  }) {
    const response = await this.prisma.responses.findUnique({
      where: { id: params.responseId },
      select: {
        id: true,
        created_at: true,
        reviewed_at: true,
        text_cipher: true,
        text_nonce: true,
        text_tag: true,
        client: { select: { full_name: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            prompt: { select: { title: true, content: true } },
            therapist: { select: { id: true, user_id: true, clinic_id: true, full_name: true } },
          },
        },
      },
    });

    if (!response || !response.assignment?.therapist) {
      throw new NotFoundException("Response not found");
    }

    if (response.assignment.therapist.clinic_id !== params.clinicId) {
      throw new ForbiddenException("Response does not belong to clinic");
    }

    if (params.role === UserRole.therapist) {
      if (response.assignment.therapist.user_id !== params.userId) {
        throw new ForbiddenException("Not your client");
      }
    } else {
      await this.ensureClinicAccess(params);
    }

    return response;
  }

  private decryptResponse(response: {
    text_cipher: Buffer;
    text_nonce: Buffer;
    text_tag: Buffer;
  }) {
    try {
      const aes = AesGcm.fromEnv();
      return aes.decrypt(response.text_cipher, response.text_nonce, response.text_tag);
    } catch {
      return "";
    }
  }

  private normalizeName(value?: string | null) {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
    return normalized.length ? normalized : null;
  }

  private buildNameAllowlist(params: { clientName?: string | null; therapistName?: string | null }) {
    const allowlist = new Set<string>();
    const addNameVariants = (value?: string | null) => {
      const normalized = this.normalizeName(value);
      if (!normalized) return;
      allowlist.add(normalized);
      const parts = normalized.split(" ").filter(Boolean);
      if (parts.length > 1) {
        allowlist.add(parts[0]);
        allowlist.add(parts[parts.length - 1]);
      }
    };
    addNameVariants(params.clientName);
    addNameVariants(params.therapistName);
    return Array.from(allowlist);
  }

  private normalizeTextWithMap(text: string) {
    let normalized = "";
    const map: number[] = [];
    let lastWasSpace = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        if (normalized.length === 0) continue;
        if (!lastWasSpace) {
          normalized += " ";
          map.push(i);
          lastWasSpace = true;
        }
        continue;
      }
      const lowered = ch.toLowerCase();
      normalized += lowered;
      map.push(i);
      lastWasSpace = false;
    }
    if (normalized.endsWith(" ")) {
      normalized = normalized.slice(0, -1);
      map.pop();
    }
    return { normalized, map };
  }

  private isWordChar(value: string | undefined) {
    if (!value) return false;
    return /[a-z0-9]/.test(value) || value === "'" || value === "-";
  }

  private isNameBoundary(normalized: string, start: number, end: number) {
    const before = start > 0 ? normalized[start - 1] : "";
    const after = end < normalized.length ? normalized[end] : "";
    return !this.isWordChar(before) && !this.isWordChar(after);
  }

  private redactAllowlistedNames(text: string, allowlist: string[]) {
    if (!text || allowlist.length === 0) return { text, count: 0 };
    const { normalized, map } = this.normalizeTextWithMap(text);
    if (!normalized) return { text, count: 0 };

    const normalizedAllowlist = Array.from(
      new Set(allowlist.map((name) => this.normalizeName(name)).filter(Boolean) as string[]),
    );

    if (normalizedAllowlist.length === 0) return { text, count: 0 };

    const ranges: Array<{ start: number; end: number }> = [];
    for (const name of normalizedAllowlist) {
      let idx = normalized.indexOf(name);
      while (idx !== -1) {
        const end = idx + name.length;
        if (this.isNameBoundary(normalized, idx, end)) {
          ranges.push({ start: idx, end });
        }
        idx = normalized.indexOf(name, idx + name.length);
      }
    }

    if (ranges.length === 0) return { text, count: 0 };

    const mappedRanges = ranges
      .map((range) => {
        const start = map[range.start];
        const end = map[range.end - 1];
        if (start === undefined || end === undefined) return null;
        return { start, end: end + 1 };
      })
      .filter(Boolean) as Array<{ start: number; end: number }>;

    mappedRanges.sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));

    const merged: Array<{ start: number; end: number }> = [];
    for (const range of mappedRanges) {
      const last = merged[merged.length - 1];
      if (!last || range.start > last.end) {
        merged.push({ ...range });
      } else if (range.end > last.end) {
        last.end = range.end;
      }
    }

    if (merged.length === 0) return { text, count: 0 };

    const pieces: string[] = [];
    let cursor = 0;
    for (const range of merged) {
      if (range.start < cursor) continue;
      pieces.push(text.slice(cursor, range.start));
      pieces.push("[REDACTED_NAME]");
      cursor = range.end;
    }
    pieces.push(text.slice(cursor));

    return { text: pieces.join(""), count: merged.length };
  }

  private async fetchReviewedResponses(params: {
    clinicId: string;
    clientId: string;
    start: Date;
    end: Date;
    nameAllowlist?: string[];
  }): Promise<ReviewedResponseEvidence[]> {
    const periodFilter = { gte: params.start, lte: params.end };
    const rows = await this.prisma.responses.findMany({
      where: {
        client_id: params.clientId,
        created_at: periodFilter,
        reviewed_at: { not: null },
        assignment: { therapist: { clinic_id: params.clinicId } },
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: {
        id: true,
        assignment_id: true,
        created_at: true,
        reviewed_at: true,
        mood: true,
        text_cipher: true,
        text_nonce: true,
        text_tag: true,
        assignment: {
          select: {
            title: true,
            prompt: { select: { title: true, content: true } },
          },
        },
      },
    });

    const nameList = params.nameAllowlist ?? [];

    return rows.map((row) => {
      const decrypted = this.decryptResponse(row);
      const redacted =
        nameList.length > 0 ? this.redactAllowlistedNames(decrypted, nameList) : { text: decrypted, count: 0 };
      return {
        id: row.id,
        assignmentId: row.assignment_id,
        assignmentTitle: row.assignment?.title ?? row.assignment?.prompt?.title ?? null,
        assignmentPrompt: row.assignment?.prompt?.content ?? null,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at ?? row.created_at,
        mood: row.mood,
        text: redacted.text,
        nameRedactionCount: redacted.count,
      };
    });
  }

  private async fetchEvidencePreview(params: {
    clinicId: string;
    clientId: string;
    start: Date;
    end: Date;
    nameAllowlist?: string[];
  }): Promise<EvidencePreview> {
    const periodFilter = { gte: params.start, lte: params.end };
    const rows = await this.prisma.responses.findMany({
      where: {
        client_id: params.clientId,
        created_at: periodFilter,
        reviewed_at: { not: null },
        assignment: { therapist: { clinic_id: params.clinicId } },
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: {
        created_at: true,
        reviewed_at: true,
        assignment: {
          select: {
            title: true,
            prompt: { select: { title: true } },
          },
        },
      },
    });

    const nameAllowlist = params.nameAllowlist ?? [];

    const items = rows.map((row) => {
      const title = row.assignment?.title ?? row.assignment?.prompt?.title ?? null;
      const redactedTitle =
        title && nameAllowlist.length > 0
          ? this.redactAllowlistedNames(title, nameAllowlist)
          : { text: title, count: 0 };
      return {
        assignment_title: redactedTitle.text,
        response_date: toDateOnlyStringLocal(row.created_at),
        reviewed_at: toDateOnlyStringLocal(row.reviewed_at ?? row.created_at),
        completion_status: "reviewed" as const,
      };
    });

    return {
      reviewed_response_count: items.length,
      items,
    };
  }

  private async fetchAssignments(params: {
    clinicId: string;
    clientId: string;
    start: Date;
    end: Date;
  }) {
    const periodFilter = { gte: params.start, lte: params.end };
    return this.prisma.assignments.findMany({
      where: {
        client_id: params.clientId,
        therapist: { clinic_id: params.clinicId },
        OR: [
          { created_at: periodFilter },
          { published_at: periodFilter },
          { due_date: periodFilter },
          { responses: { some: { created_at: periodFilter } } },
        ],
      },
      select: {
        id: true,
        title: true,
        created_at: true,
        published_at: true,
        due_date: true,
        prompt: { select: { title: true } },
      },
    });
  }

  private buildAssignmentSummaries(
    assignments: Array<{
      id: string;
      title: string | null;
      created_at: Date;
      published_at: Date | null;
      due_date: Date | null;
      prompt: { title: string } | null;
    }>,
    responses: ReviewedResponseEvidence[],
    nameAllowlist: string[] = [],
  ) {
    const counts = new Map<string, { total: number; reviewed: number }>();
    for (const response of responses) {
      const current = counts.get(response.assignmentId) ?? { total: 0, reviewed: 0 };
      current.total += 1;
      current.reviewed += 1;
      counts.set(response.assignmentId, current);
    }

    let nameRedactionCount = 0;
    const items = assignments.map((assignment) => {
      const summary = counts.get(assignment.id) ?? { total: 0, reviewed: 0 };
      const assignedAt = assignment.published_at ?? assignment.created_at;
      const title = assignment.title ?? assignment.prompt?.title ?? null;
      const redactedTitle =
        title && nameAllowlist.length > 0
          ? this.redactAllowlistedNames(title, nameAllowlist)
          : { text: title, count: 0 };
      nameRedactionCount += redactedTitle.count;

      return {
        assignment_title: redactedTitle.text,
        assigned_at: assignedAt ? toDateOnlyStringLocal(assignedAt) : null,
        due_date: assignment.due_date ? toDateOnlyStringLocal(assignment.due_date) : null,
        response_count: summary.total,
        reviewed_response_count: summary.reviewed,
      };
    });

    return { items, nameRedactionCount };
  }

  private buildEvidenceRefs(responses: ReviewedResponseEvidence[], nameAllowlist: string[] = []) {
    let nameRedactionCount = 0;
    const sorted = responses
      .slice()
      .sort((a, b) => {
        const at = a.createdAt.getTime() - b.createdAt.getTime();
        if (at !== 0) return at;
        return a.id.localeCompare(b.id);
      })
      .map((response) => {
        const title = response.assignmentTitle ?? "Assignment";
        const redactedTitle =
          nameAllowlist.length > 0
            ? this.redactAllowlistedNames(title, nameAllowlist)
            : { text: title, count: 0 };
        nameRedactionCount += redactedTitle.count;
        return `${redactedTitle.text} — ${toDateOnlyStringLocal(response.createdAt)}`;
      });

    return { refs: Array.from(new Set(sorted)), nameRedactionCount };
  }

  private pickApplyTargetResponseId(responses: ReviewedResponseEvidence[]) {
    const sorted = responses
      .slice()
      .sort((a, b) => {
        const at = (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0);
        if (at !== 0) return at;
        const created = b.createdAt.getTime() - a.createdAt.getTime();
        if (created !== 0) return created;
        return a.id.localeCompare(b.id);
      });
    return sorted[0]?.id ?? null;
  }

  private async fetchEscalationContext(params: {
    clinicId: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const startParts = this.parseDateOnlyOrThrow(params.periodStart, "periodStart");
    const endParts = this.parseDateOnlyOrThrow(params.periodEnd, "periodEnd");
    const startDate = buildStorageDateFromParts(startParts);
    const endDate = buildStorageDateFromParts(endParts);

    const rows = await this.prisma.supervisor_escalations.findMany({
      where: {
        clinic_id: params.clinicId,
        client_id: params.clientId,
        period_start: { lte: endDate },
        period_end: { gte: startDate },
      },
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      take: 5,
    });

    if (rows.length === 0) return null;

    const open = rows.find((row) => row.status === SupervisorEscalationStatus.OPEN) ?? rows[0];

    return {
      id: open.id,
      status: open.status,
      reason: open.reason,
      periodStart: formatDateOnly(dateOnlyPartsFromUTC(open.period_start)),
      periodEnd: formatDateOnly(dateOnlyPartsFromUTC(open.period_end)),
      createdAt: open.created_at.toISOString(),
      resolvedAt: open.resolved_at ? open.resolved_at.toISOString() : null,
    };
  }

  private async generateDraft(params: {
    userId: string;
    role: UserRole;
    clinicId: string;
    purpose: AiPurpose;
    promptPurpose: string;
    promptVersion: string;
    assistant: string;
    payload: Record<string, any>;
    evidenceRefs: string[];
    nameRedactionCount: number;
    instructions: string[];
  }) {
    const processed = await this.gateway.processRequest({
      clinicId: params.clinicId,
      userId: params.userId,
      role: params.role,
      purpose: params.purpose,
      payload: params.payload,
      extraRedactionStats: { names: params.nameRedactionCount },
    });

    if (!processed.allowed) {
      return {
        ok: false,
        denial_reason: processed.denialReason ?? "AI_DISABLED",
        sanitized_hash: processed.sanitizedHash,
        redaction_stats: processed.redactionStats,
      };
    }

    const prompt = buildDraftPrompt({
      assistant: params.assistant,
      purpose: params.promptPurpose,
      payload: processed.sanitizedPayload as Record<string, any>,
      schema: DRAFT_RESPONSE_SCHEMA,
      instructions: params.instructions,
    });

    const content = await this.generateStructuredOrThrow<DraftContent>({
      purpose: params.purpose,
      prompt,
      schema: DRAFT_RESPONSE_SCHEMA,
      temperature: 0,
      maxTokens: 768,
    });

    const text = typeof content?.text === "string" ? content.text.trim() : "";
    const generatedAt = new Date().toISOString();

    return {
      assistant: params.assistant,
      version: "v1",
      text: text || "Draft unavailable.",
      evidence_refs: params.evidenceRefs,
      purpose: params.promptPurpose,
      prompt_version: params.promptVersion,
      generated_at: generatedAt,
      disclaimer: DRAFT_ONLY_DISCLAIMER,
      sanitized_hash: processed.sanitizedHash,
      redaction_stats: processed.redactionStats,
    };
  }

  private async generateStructuredOrThrow<T>(input: LlmGenerateInput): Promise<T> {
    try {
      return await this.provider.generateStructured<T>(input);
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException) {
        throw new ServiceUnavailableException("AI provider unavailable; drafts disabled.");
      }
      if (typeof error?.message === "string" && error.message.includes("provider not configured")) {
        throw new ServiceUnavailableException("AI provider unavailable; drafts disabled.");
      }
      throw error;
    }
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
