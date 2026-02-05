import { MockProvider } from "./mock.provider";
import { buildAdherencePrompt } from "../prompts/adherence.prompt";
import { buildAssessmentPrompt } from "../prompts/assessment.prompt";
import { ADHERENCE_RESPONSE_SCHEMA } from "../schemas/adherence.schema";
import { ASSESSMENT_RESPONSE_SCHEMA } from "../schemas/assessment.schema";

const provider = new MockProvider();

describe("MockProvider", () => {
  it("returns deterministic adherence output", async () => {
    const payload = {
      completion_criteria: "Describe two coping skills you practiced.",
      client_response: "I used deep breathing and journaling.",
      context: { assignment_title: "Coping Skills", program: null },
    };

    const prompt = buildAdherencePrompt({
      payload,
      sources: [],
      schema: ADHERENCE_RESPONSE_SCHEMA,
    });

    const output1 = await provider.generateStructured<any>({
      purpose: "ADHERENCE_REVIEW",
      prompt,
      schema: ADHERENCE_RESPONSE_SCHEMA,
      temperature: 0,
    });

    const output2 = await provider.generateStructured<any>({
      purpose: "ADHERENCE_REVIEW",
      prompt,
      schema: ADHERENCE_RESPONSE_SCHEMA,
      temperature: 0,
    });

    expect(output1).toEqual(output2);
    expect(output1.criteria_match).toBeDefined();
    expect(output1.evidence_snippets).toBeDefined();
  });

  it("returns deterministic assessment output", async () => {
    const payload = {
      assessment_type: "ASAM",
      inputs: { D1: "No withdrawal", D2: "Hypertension" },
      note: "Draft summary",
    };

    const prompt = buildAssessmentPrompt({
      payload,
      sources: [],
      schema: ASSESSMENT_RESPONSE_SCHEMA,
    });

    const output1 = await provider.generateStructured<any>({
      purpose: "DOCUMENTATION",
      prompt,
      schema: ASSESSMENT_RESPONSE_SCHEMA,
      temperature: 0,
    });

    const output2 = await provider.generateStructured<any>({
      purpose: "DOCUMENTATION",
      prompt,
      schema: ASSESSMENT_RESPONSE_SCHEMA,
      temperature: 0,
    });

    expect(output1).toEqual(output2);
    expect(output1.draft_sections).toBeDefined();
    expect(output1.gaps_questions).toBeDefined();
  });
});
