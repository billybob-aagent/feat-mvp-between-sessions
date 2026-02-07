export type SubmissionProfileKey = "GENERIC" | "IOP" | "PHP" | "MAT";

export type SubmissionProfile = {
  key: SubmissionProfileKey;
  display_name: string;
  required_artifacts: string[];
  recommended_period_days: number;
  highlight_sections: string[];
  disclaimer_block: string;
  acceptance_language: string;
};

const ACCEPTANCE_LANGUAGE_COMMON = [
  "This submission includes deterministic adherence evidence captured contemporaneously.",
  "Missing data is explicitly labeled; no evidence is inferred.",
  "AER does not determine medical necessity, diagnosis, or payer eligibility.",
].join("\n");

export const SUBMISSION_PROFILES: Record<SubmissionProfileKey, SubmissionProfile> = {
  GENERIC: {
    key: "GENERIC",
    display_name: "Generic (Default)",
    required_artifacts: ["AER.json", "AER.pdf", "verification.txt"],
    recommended_period_days: 7,
    highlight_sections: ["prescribed_interventions", "adherence_timeline"],
    disclaimer_block:
      "Profile is presentation-only. Evidence is unchanged and derived from the system of record.",
    acceptance_language: [
      "AER is a deterministic evidence artifact for the requested period.",
      ACCEPTANCE_LANGUAGE_COMMON,
    ].join("\n"),
  },
  IOP: {
    key: "IOP",
    display_name: "Intensive Outpatient Program (IOP)",
    required_artifacts: ["AER.json", "AER.pdf", "verification.txt", "weekly_packet.json"],
    recommended_period_days: 7,
    highlight_sections: ["prescribed_interventions", "adherence_timeline", "clinician_review"],
    disclaimer_block:
      "IOP profile emphasizes weekly adherence evidence. Evidence content is unchanged.",
    acceptance_language: [
      "This submission supports IOP oversight for a defined seven-day period.",
      ACCEPTANCE_LANGUAGE_COMMON,
    ].join("\n"),
  },
  PHP: {
    key: "PHP",
    display_name: "Partial Hospitalization Program (PHP)",
    required_artifacts: ["AER.json", "AER.pdf", "verification.txt", "weekly_packet.json"],
    recommended_period_days: 7,
    highlight_sections: ["prescribed_interventions", "adherence_timeline", "noncompliance_escalations"],
    disclaimer_block:
      "PHP profile emphasizes weekly adherence evidence and escalation visibility.",
    acceptance_language: [
      "This submission supports PHP oversight for a defined seven-day period.",
      ACCEPTANCE_LANGUAGE_COMMON,
    ].join("\n"),
  },
  MAT: {
    key: "MAT",
    display_name: "Medication-Assisted Treatment (MAT)",
    required_artifacts: ["AER.json", "AER.pdf", "verification.txt"],
    recommended_period_days: 14,
    highlight_sections: ["prescribed_interventions", "adherence_timeline"],
    disclaimer_block:
      "MAT profile emphasizes a longer period window for adherence continuity.",
    acceptance_language: [
      "This submission supports MAT oversight for a defined fourteen-day period.",
      ACCEPTANCE_LANGUAGE_COMMON,
    ].join("\n"),
  },
};

export const FORBIDDEN_LANGUAGE = [
  "AER determines medical necessity.",
  "AER is an AI decision or diagnosis.",
  "AER guarantees outcomes or adherence.",
  "AER replaces clinical judgment.",
  "Payer approval is implied by this report.",
];

export function getSubmissionProfile(key: string | undefined): SubmissionProfile {
  const normalized = (key ?? "GENERIC").toUpperCase() as SubmissionProfileKey;
  return SUBMISSION_PROFILES[normalized] ?? SUBMISSION_PROFILES.GENERIC;
}
