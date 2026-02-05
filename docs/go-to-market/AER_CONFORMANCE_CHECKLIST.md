# AER Conformance Checklist (v1.0)

Use this checklist to validate AER implementations against the published standard.

## Determinism
- [ ] Same inputs produce identical JSON output.
- [ ] Same inputs produce identical PDF output (hash stable).
- [ ] Timeline ordering is deterministic.

## Period Stability
- [ ] Start/end are date-only (YYYY-MM-DD).
- [ ] Report period fields match requested date strings.
- [ ] No timezone drift between display and query boundaries.

## Evidence Integrity
- [ ] All events are attributed (actor + timestamp).
- [ ] Evidence is captured as recorded, not inferred.
- [ ] Partial adherence is explicitly labeled.

## Missing Data Handling
- [ ] Missing fields are null or omitted as defined.
- [ ] `not_available` lists every unpopulated section.
- [ ] No placeholder values presented as evidence.

## External Access Controls
- [ ] External tokens are time-limited.
- [ ] Tokens are scoped (clinic/client/period/report_type).
- [ ] Tokens are revocable.
- [ ] Token usage is logged.

## Audit Logging
- [ ] Report generation is logged (who/when).
- [ ] External access attempts are logged.
- [ ] No raw PHI stored in logs.

## AI Assistance Boundaries
- [ ] AI output is draft-only.
- [ ] No diagnosis or treatment recommendation is produced.
- [ ] AI use is disclosed when present.
