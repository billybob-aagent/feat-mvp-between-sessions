export type SubmissionProfileKey = "GENERIC" | "IOP" | "PHP" | "MAT";

export type SubmissionProfile = {
  key: SubmissionProfileKey;
  displayName: string;
  requiredArtifacts: string[];
  recommendedPeriodDays: number;
  highlightSections: string[];
  disclaimer: string;
  acceptanceLanguage: string;
};

const COMMON_LANGUAGE = [
  "This submission includes deterministic adherence evidence captured contemporaneously.",
  "Missing data is explicitly labeled; no evidence is inferred.",
  "AER does not determine medical necessity, diagnosis, or payer eligibility.",
].join("\n");

export const SUBMISSION_PROFILES: Record<SubmissionProfileKey, SubmissionProfile> = {
  GENERIC: {
    key: "GENERIC",
    displayName: "Generic (Default)",
    requiredArtifacts: ["AER.json", "AER.pdf", "verification.txt"],
    recommendedPeriodDays: 7,
    highlightSections: ["prescribed_interventions", "adherence_timeline"],
    disclaimer: "Profile is presentation-only. Evidence is unchanged and derived from the system of record.",
    acceptanceLanguage: [
      "AER is a deterministic evidence artifact for the requested period.",
      COMMON_LANGUAGE,
    ].join("\n"),
  },
  IOP: {
    key: "IOP",
    displayName: "Intensive Outpatient Program (IOP)",
    requiredArtifacts: ["AER.json", "AER.pdf", "verification.txt", "weekly_packet.json"],
    recommendedPeriodDays: 7,
    highlightSections: ["prescribed_interventions", "adherence_timeline", "clinician_review"],
    disclaimer: "IOP profile emphasizes weekly adherence evidence. Evidence content is unchanged.",
    acceptanceLanguage: [
      "This submission supports IOP oversight for a defined seven-day period.",
      COMMON_LANGUAGE,
    ].join("\n"),
  },
  PHP: {
    key: "PHP",
    displayName: "Partial Hospitalization Program (PHP)",
    requiredArtifacts: ["AER.json", "AER.pdf", "verification.txt", "weekly_packet.json"],
    recommendedPeriodDays: 7,
    highlightSections: ["prescribed_interventions", "adherence_timeline", "noncompliance_escalations"],
    disclaimer: "PHP profile emphasizes weekly adherence evidence and escalation visibility.",
    acceptanceLanguage: [
      "This submission supports PHP oversight for a defined seven-day period.",
      COMMON_LANGUAGE,
    ].join("\n"),
  },
  MAT: {
    key: "MAT",
    displayName: "Medication-Assisted Treatment (MAT)",
    requiredArtifacts: ["AER.json", "AER.pdf", "verification.txt"],
    recommendedPeriodDays: 14,
    highlightSections: ["prescribed_interventions", "adherence_timeline"],
    disclaimer: "MAT profile emphasizes a longer period window for adherence continuity.",
    acceptanceLanguage: [
      "This submission supports MAT oversight for a defined fourteen-day period.",
      COMMON_LANGUAGE,
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
