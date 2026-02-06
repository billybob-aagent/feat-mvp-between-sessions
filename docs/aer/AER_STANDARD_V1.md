# Adherence Evidence Report (AER) External Standard — v1

**Status:** Authoritative, public, payer-facing standard for Between Sessions / Atlas Core.
**Version:** v1 (see Version Governance).

## Purpose
AER is a deterministic, audit-ready evidence artifact that reconstructs between-session adherence for a single client within a clinic over a defined period. It is designed to support payer review, utilization review (UR), and external audit processes without requiring access to internal systems.

## Scope
AER v1 defines:
- The AER JSON contract and normative field semantics.
- Determinism guarantees for JSON and PDF outputs.
- Evidence provenance, audit integrity, and missing-data handling.
- External verification requirements.

## Non-Goals
AER is **not**:
- A clinical diagnosis or medical necessity engine.
- An AI judgment or inference layer.
- A billing adjudication rule-set.
- A replacement for raw clinical documentation.

## Determinism & Reproducibility
AER is deterministic by design:
- **Same inputs → identical JSON.**
- **Same inputs → identical PDF bytes.**

**Inputs** are defined as:
- `clinic_id`
- `client_id`
- `period.start` (YYYY-MM-DD)
- `period.end` (YYYY-MM-DD)
- `program` (string or null; no filtering unless explicitly supported)
- The system-of-record data snapshot at generation time (assignments, responses, check-ins, feedback, notifications).

**Ordering rules (normative):**
- `adherence_timeline` is ordered ascending by `ts`.
- `noncompliance_escalations` is ordered ascending by `ts`.
- `prescribed_interventions` ordering is **not semantically meaningful** and MUST NOT be used to infer priority. Consumers SHOULD treat it as an unordered set. If ordering is required for display, sort by `assigned_at`, then `assignment_id`.

## Date-Only Period Semantics (Timezone Drift Forbidden)
AER uses **date-only** strings in the `YYYY-MM-DD` format for `meta.period.start` and `meta.period.end`.

These represent **calendar dates**, not timestamps. They MUST NOT be parsed or converted to timestamps using timezone offsets. Any timezone conversion can shift day boundaries and alter `report_id` values, breaking determinism and auditability.

**Rule:** treat date-only values as **literal calendar dates**. No timezone drift is permitted.

## AI Boundaries
AER explicitly excludes AI output. AI drafts are **draft-only** and are never included in AER JSON or PDF. Any AI-generated text must not appear in this artifact.

## Required Top-Level Fields
AER JSON MUST include the following top-level fields:
- `meta`
- `context`
- `prescribed_interventions`
- `adherence_timeline`
- `noncompliance_escalations`
- `clinician_review`
- `audit_integrity`
- `not_available`

## JSON Contract (AER v1)
See `AER_STANDARD_V1.schema.json` for the authoritative JSON Schema.

### meta
- `report_type`: fixed value `AER`.
- `version`: fixed value `v1`.
- `generated_at`: deterministic ISO 8601 timestamp in UTC. It MUST be derived from the period end date (end-of-day) so identical inputs produce identical JSON.
- `period.start` / `period.end`: date-only strings (`YYYY-MM-DD`).
- `clinic_id`: UUID string identifying the clinic.
- `client_id`: UUID string identifying the client.
- `program`: string or null. If program filtering is unsupported, this is echoed and noted in `not_available`.
- `generated_by`: fixed `{ type: "system", id: "backend" }`.

### context
- `clinic.name`: clinic display name (string or null).
- `client.display_id`: optional display identifier (string or null). If not stored, it is null and listed in `not_available`.

### prescribed_interventions
Each entry represents a prescribed assignment.
- `assignment_id`: UUID string.
- `title`: assignment title (string or null).
- `library_source`: metadata for library-backed assignments, or null for custom assignments.
- `assigned_by`: clinician identifier and name.
- `assigned_at`: ISO timestamp (string or null).
- `due.start` / `due.end`: ISO timestamp (string or null).
- `completion_criteria`: string or null.
- `completed_at`: ISO timestamp (string or null).
- `reviewed_at`: ISO timestamp (string or null).
- `reviewed_by`: clinician identifier and name.
- `evidence_refs`: array of response IDs used as evidence.
- `status_summary`: integer counters for `completed`, `partial`, `missed`, `late`.

### adherence_timeline
A normalized timeline of adherence events.
- `ts`: ISO timestamp.
- `type`: one of
  - `assignment_completed`
  - `assignment_partial`
  - `assignment_missed`
  - `checkin`
  - `feedback`
  - `notification_sent`
  - `other`
- `source`: `client`, `system`, or `clinician`.
- `ref.assignment_id` / `ref.response_id`: related identifiers or null.
- `details`: free-form metadata (no PHI). This field is intentionally extensible for audit context.

### noncompliance_escalations
Derived escalation or reminder events (if available).
- `ts`: ISO timestamp.
- `type`: `reminder` or `escalation`.
- `channel`: `email`, `sms`, `inapp`, or `unknown`.
- `details`: free-form metadata (no PHI).

### clinician_review
Review summary for the report period.
- `reviewed`: boolean.
- `reviewed_at`: ISO timestamp or null.
- `reviewed_by`: clinician identifier and name.
- `notes`: string or null.

### audit_integrity
Audit metadata for reproducibility.
- `data_sources`: array of system-of-record sources.
- `notes`: static text describing provenance.
- `report_id`: stable identifier: `AER-v1:<clinicId>:<clientId>:<start>:<end>[:<program>]`.
- `hash`: optional hash string (null in v1).

### not_available
An array of strings listing fields or sections that cannot be populated due to missing schema support. Missing data is **explicit**, never inferred.

## Verifiability
AER v1 is intended to be independently verifiable using:
- The JSON Schema (`AER_STANDARD_V1.schema.json`).
- Deterministic hashing of JSON and PDF outputs.
- A read-only verification tool (`scripts/verify_aer.sh`).

## Version Governance
### Versioning Rules
- `meta.version` is the canonical version identifier.
- v1 uses `meta.version = "v1"` and the schema in `AER_STANDARD_V1.schema.json`.

### Backwards Compatibility (Default)
- New data MUST be introduced in **explicit extension containers** (e.g., `meta.extensions`, `context.extensions`, or `audit_integrity.extensions`) or in `details` fields. This avoids breaking v1 consumers.
- New required fields or semantic changes require a **major** version.

### Deprecation Policy
- Deprecated fields MUST remain valid for at least one major version cycle.
- Deprecations are documented and date-stamped in release notes.

### Change Control
- **Major**: breaking changes to structure, semantics, or determinism guarantees.
- **Minor**: additive, backward-compatible changes using extension containers.
- **Patch**: documentation clarifications only; no contract changes.
