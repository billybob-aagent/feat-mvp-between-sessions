# AER (Adherence Evidence Report) — Specification v1.0

## 1. Purpose
The Adherence Evidence Report (AER) is a **standardized, period‑stable evidence artifact** that documents between‑session adherence in structured behavioral health programs.
It is designed for audits, utilization review, and compliance validation.

**AER IS**
- Evidence of adherence to prescribed interventions within a defined date range.
- A deterministic, repeatable report built from system‑of‑record events.

**AER IS NOT**
- A clinical judgment, diagnosis, or treatment recommendation.
- A substitute for clinician review or medical necessity determinations.

---

## 2. Core Principles
1. **Determinism**
   Same inputs → same output. No stochastic generation.

2. **Period Stability**
   Date‑only boundaries (YYYY‑MM‑DD) prevent timezone drift.

3. **Evidence Traceability**
   Each event is attributable to actor, time, and source.

4. **Human‑in‑the‑Loop Review**
   Clinician oversight is explicit and required.

5. **Auditability**
   Generation timestamps, report IDs, and source listings are immutable.

---

## 3. Data Domains
AER v1 includes (where available):

- **Interventions Assigned**
  Prescribed assignments with due windows and criteria.

- **Client Responses**
  Recorded responses and completion outcomes.

- **Completion Criteria**
  Textual criteria associated with assignments.

- **Supervisor Escalation Signals**
  Escalations, reminders, non‑compliance notices.

- **Resolution + SLA Metadata**
  Resolution status and time‑to‑resolve (if tracked).

---

## 4. Evidence Rules
- **Evidence qualifies** when it is captured as a system‑of‑record event with timestamp and actor attribution.
- **Partial adherence** is explicitly labeled (not inferred).
- **Missing data** is explicitly reported (e.g., `not_available`), never imputed.
- **No evidence rewriting**: AER reflects recorded events only.

---

## 5. Governance & Controls
- **Role‑based access** (admin/clinical roles only).
- **External read‑only tokenization** for auditors or payers.
- **Immutable generation metadata** (report ID, generated_at).
- **AI assistance boundaries**: draft‑only, non‑diagnostic, clinician‑reviewed.

---

## 6. External Consumption
### JSON (Primary Artifact)
- Stable field names and deterministic ordering.
- Period is explicitly date‑only.

### Deterministic PDF (Secondary Artifact)
- Fixed layout, fonts, and pagination.
- No locale‑dependent formatting.
- Same inputs → identical file size and hash.

### Verifiability Guarantees
- Report ID derived from period + clinic + client context.
- Audit logs record generation events.
- External access tokens are time‑limited and scoped.

---

## 7. Non‑Goals (Critical)
- Not a clinical judgment tool
- Not an AI therapist
- Not a replacement for clinician review
- Not a medical necessity engine

---

## 8. Versioning & Compatibility
- **v1** is stable and backwards compatible for all minor revisions.
- **New fields** may be added but never remove/rename existing fields.
- **Deprecations** require explicit notice and a minimum sunset period.
- **Version is embedded** in the report payload (`meta.version`).
