import { ServiceUnavailableException } from "@nestjs/common";
import { AiPurpose, UserRole } from "@prisma/client";
import { AiAssistService } from "./ai-assist.service";
import { ADHERENCE_RESPONSE_SCHEMA } from "./schemas/adherence.schema";
import { ASSESSMENT_RESPONSE_SCHEMA } from "./schemas/assessment.schema";
import { NO_SOURCES_NOTICE } from "./utils/disclaimers";

const redactionStats = {
  emails: 1,
  phones: 0,
  urls: 0,
  addresses: 0,
  ssn: 0,
  names: 0,
};

describe("AiAssistService", () => {
  it("returns denied when gateway denies", async () => {
    const gatewayMock = {
      processRequest: jest.fn().mockResolvedValue({
        allowed: false,
        denialReason: "AI_DISABLED",
        sanitizedPayload: {},
        sanitizedHash: "hash-1",
        redactionStats,
      }),
    };

    const providerMock = { generateStructured: jest.fn() };
    const retrievalMock = { retrieveApprovedSources: jest.fn() };
    const service = new AiAssistService(
      gatewayMock as any,
      retrievalMock as any,
      providerMock as any,
    );

    const result = (await service.adherenceAssist({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      payload: {
        clinicId: "clinic-1",
        clientId: "client-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-02-04",
        completion_criteria: "Describe two coping skills.",
        client_response: "",
        context: null,
      },
    })) as any;

    expect(result.ok).toBe(false);
    expect(result.denial_reason).toBe("AI_DISABLED");
    expect(providerMock.generateStructured).not.toHaveBeenCalled();
    expect(retrievalMock.retrieveApprovedSources).not.toHaveBeenCalled();
  });

  it("uses sanitized payload for adherence prompts", async () => {
    const gatewayMock = {
      processRequest: jest.fn().mockResolvedValue({
        allowed: true,
        sanitizedPayload: {
          completion_criteria: "Describe two coping skills.",
          client_response: "Email [REDACTED_EMAIL]",
          context: { assignment_title: "Test", program: null },
          periodStart: "2026-01-01",
          periodEnd: "2026-02-04",
          clientId: "client-1",
          clinicId: "clinic-1",
        },
        sanitizedHash: "hash-2",
        redactionStats,
      }),
    };

    const providerMock = {
      generateStructured: jest.fn().mockResolvedValue({
        criteria_match: "MET",
        confidence: "HIGH",
        evidence_snippets: [{ text: "Email [REDACTED_EMAIL]", reason: "Reason" }],
        missing_elements: [],
        suggested_clinician_feedback_draft: "Thanks for the update.",
      }),
    };

    const retrievalMock = {
      retrieveApprovedSources: jest.fn().mockResolvedValue({
        sources: [
          {
            id: "chunk-1",
            itemId: "item-1",
            title: "Guide",
            headingPath: "Section",
            text: "Text",
          },
        ],
        sourceItemIds: ["item-1"],
      }),
    };

    const service = new AiAssistService(
      gatewayMock as any,
      retrievalMock as any,
      providerMock as any,
    );

    const result = (await service.adherenceAssist({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      payload: {
        clinicId: "clinic-1",
        clientId: "client-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-02-04",
        completion_criteria: "Describe two coping skills.",
        client_response: "Raw response",
        context: { assignment_title: "Test", program: null },
      },
    })) as any;

    const call = providerMock.generateStructured.mock.calls[0][0];
    expect(call.purpose).toBe(AiPurpose.ADHERENCE_REVIEW);
    expect(call.schema).toBe(ADHERENCE_RESPONSE_SCHEMA);
    expect(call.prompt).toContain("[REDACTED_EMAIL]");

    expect(result.assistant).toBe("LLM-1_ADHERENCE_EVIDENCE");
    expect(result.criteria_match).toBe("MET");
    expect(result.sanitized_hash).toBe("hash-2");
    expect(result.sources_used).toEqual(["item-1"]);
  });

  it("returns assessment draft with gaps", async () => {
    const gatewayMock = {
      processRequest: jest.fn().mockResolvedValue({
        allowed: true,
        sanitizedPayload: {
          assessment_type: "ASAM",
          inputs: { D1: "No withdrawal" },
          note: "Draft summary",
          clientId: "client-1",
          clinicId: "clinic-1",
        },
        sanitizedHash: "hash-3",
        redactionStats,
      }),
    };

    const providerMock = {
      generateStructured: jest.fn().mockResolvedValue({
        draft_sections: [{ title: "Dimension 1 (D1)", content: "No withdrawal" }],
        gaps_questions: ["Provide details for D2."],
        evidence_mapping: [{ input_key: "D1", used_in_section: "Dimension 1 (D1)" }],
      }),
    };

    const retrievalMock = {
      retrieveApprovedSources: jest.fn().mockResolvedValue({
        sources: [],
        sourceItemIds: [],
      }),
    };

    const service = new AiAssistService(
      gatewayMock as any,
      retrievalMock as any,
      providerMock as any,
    );

    const result = (await service.assessmentAssist({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      payload: {
        clinicId: "clinic-1",
        clientId: "client-1",
        assessment_type: "ASAM",
        inputs: { D1: "No withdrawal" },
        note: "Draft summary",
      },
    })) as any;

    const call = providerMock.generateStructured.mock.calls[0][0];
    expect(call.purpose).toBe(AiPurpose.DOCUMENTATION);
    expect(call.schema).toBe(ASSESSMENT_RESPONSE_SCHEMA);

    expect(result.assistant).toBe("LLM-2_ASSESSMENT_DRAFT");
    expect(result.draft_sections.length).toBeGreaterThan(0);
    expect(result.gaps_questions.length).toBeGreaterThan(0);
    expect(result.gaps_questions).toContain(NO_SOURCES_NOTICE);
  });

  it("adds no-source notice for adherence when retrieval is empty", async () => {
    const gatewayMock = {
      processRequest: jest.fn().mockResolvedValue({
        allowed: true,
        sanitizedPayload: {
          completion_criteria: "Describe two coping skills.",
          client_response: "I practiced breathing.",
          context: null,
          periodStart: "2026-01-01",
          periodEnd: "2026-02-04",
          clientId: "client-1",
          clinicId: "clinic-1",
        },
        sanitizedHash: "hash-5",
        redactionStats,
      }),
    };

    const providerMock = {
      generateStructured: jest.fn().mockResolvedValue({
        criteria_match: "PARTIAL",
        confidence: "MEDIUM",
        evidence_snippets: [{ text: "I practiced breathing.", reason: "Mentions breathing" }],
        missing_elements: [],
        suggested_clinician_feedback_draft: "Thanks for the update.",
      }),
    };

    const retrievalMock = {
      retrieveApprovedSources: jest.fn().mockResolvedValue({
        sources: [],
        sourceItemIds: [],
      }),
    };

    const service = new AiAssistService(
      gatewayMock as any,
      retrievalMock as any,
      providerMock as any,
    );

    const result = (await service.adherenceAssist({
      userId: "user-1",
      role: UserRole.CLINIC_ADMIN,
      payload: {
        clinicId: "clinic-1",
        clientId: "client-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-02-04",
        completion_criteria: "Describe two coping skills.",
        client_response: "I practiced breathing.",
        context: null,
      },
    })) as any;

    expect(result.missing_elements).toContain(NO_SOURCES_NOTICE);
    expect(result.suggested_clinician_feedback_draft).toContain(NO_SOURCES_NOTICE);
  });

  it("propagates provider failures", async () => {
    const gatewayMock = {
      processRequest: jest.fn().mockResolvedValue({
        allowed: true,
        sanitizedPayload: {
          completion_criteria: "Describe two coping skills.",
          client_response: "Response",
          context: null,
          periodStart: "2026-01-01",
          periodEnd: "2026-02-04",
          clientId: "client-1",
          clinicId: "clinic-1",
        },
        sanitizedHash: "hash-4",
        redactionStats,
      }),
    };

    const retrievalMock = {
      retrieveApprovedSources: jest.fn().mockResolvedValue({
        sources: [],
        sourceItemIds: [],
      }),
    };

    const providerMock = {
      generateStructured: jest.fn().mockRejectedValue(
        new ServiceUnavailableException("AI provider not configured"),
      ),
    };

    const service = new AiAssistService(
      gatewayMock as any,
      retrievalMock as any,
      providerMock as any,
    );

    await expect(
      service.adherenceAssist({
        userId: "user-1",
        role: UserRole.CLINIC_ADMIN,
        payload: {
          clinicId: "clinic-1",
          clientId: "client-1",
          periodStart: "2026-01-01",
          periodEnd: "2026-02-04",
          completion_criteria: "Describe two coping skills.",
          client_response: "Response",
          context: null,
        },
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
