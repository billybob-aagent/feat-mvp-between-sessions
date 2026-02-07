# Adherence Evidence Report (AER) Public Standard — v1

**Status:** Public, audit-facing standard for Between Sessions / Atlas Core AER artifacts.
**Version:** v1 (public summary aligned to internal v1.x).

## Purpose
AER is a deterministic, audit-ready evidence artifact that reconstructs between-session adherence for a single client within a clinic over a defined period. It is designed to support payer review, utilization review (UR), and external audit processes without requiring access to internal systems.

## Scope
This standard defines:
- What AER is and is not.
- Determinism guarantees for JSON and PDF outputs.
- Date-only period semantics.
- Evidence inclusion and review requirements.
- AI boundaries.
- Versioning and change control.

## Non-Goals
AER is **not**:
- A diagnosis, medical necessity engine, or billing rule set.
- An AI judgment layer.
- A replacement for the source clinical record.

## Determinism Guarantees
AER is deterministic by design.
- **Same inputs → identical JSON.**
- **Same inputs → identical PDF bytes.**

**Inputs** are limited to:
- `clinic_id`
- `client_id`
- `period.start` (YYYY-MM-DD)
- `period.end` (YYYY-MM-DD)
- `program` (string or null; not filtered unless explicitly supported)
- The system-of-record snapshot at generation time (assignments, responses, check-ins, feedback, notifications).

Consumers MUST treat AER as a deterministic reconstruction, not a live query.

## Date-Only Period Semantics (Timezone Drift Forbidden)
AER uses **date-only** strings in `YYYY-MM-DD` format for `period.start` and `period.end`.

These represent calendar dates, not timestamps. They MUST NOT be converted across timezones. Any timezone conversion can shift day boundaries, alter `report_id`, and break determinism.

**Rule:** treat date-only values as literal calendar dates. No timezone drift is permitted.

## Evidence Inclusion Rules
Evidence is included if it meets all of the following:
- Belongs to the specified `clinic_id` and `client_id`.
- Falls within the specified period boundaries.
- Exists in the system-of-record (responses, check-ins, feedback, notifications).

If evidence is missing or out of period, it is **explicitly surfaced** as missing or not available. AER never infers or fabricates evidence.

## Review Requirements
AER distinguishes between recorded events and clinician review.
- Review status is derived from explicit review actions.
- If a response is unreviewed, the report reflects that status.
- Review requirements are never inferred.

## AI Boundaries
AI output is **draft-only** and is **never included** in AER JSON or PDF. AER contains only system-of-record evidence.

## Versioning Policy
- `meta.version` is the canonical version identifier.
- Minor versions are additive only and do not break v1 consumers.
- Major versions allow breaking changes, but MUST be published with clear migration guidance.

## Explicit Non-Goals
AER does not:
- Determine medical necessity.
- Substitute for clinician judgment.
- Create or modify evidence.
- Guarantee outcomes, only the existence of recorded adherence events.

