# AER Positioning: What It Is / What It Is Not

This document is intended for payers, utilization review (UR), auditors, and external partners.

## AER Is
- **A contemporaneous evidence artifact** summarizing recorded adherence events over a defined period.
- **A deterministic reconstruction** of system-of-record events (assignments, responses, check-ins, feedback, notifications) captured during care delivery.
- **A stable, verifiable record**: same inputs yield identical JSON and identical PDF bytes.

## AER Is Not
- **A diagnosis**.
- **A medical necessity engine**.
- **An AI judgment** or inference layer.

## Why AER Reduces UR Denials and Recoupment Risk
- It provides **objective, timestamped evidence** of adherence behaviors and clinician review activity.
- It is **deterministic** and **reproducible**, enabling independent verification by payers and auditors.
- It **does not infer missing data**: gaps are explicitly listed in `not_available` to prevent over-interpretation.

## Missing Data Is Explicit (Never Inferred)
AER never fabricates or fills missing data. If source tables or fields are unavailable, AER lists those gaps explicitly in `not_available`. This prevents false certainty and supports defensible audit outcomes.

## AI Boundary
AI-generated drafts or summaries are **draft-only** and never included in AER JSON or PDF. AER is a **human-auditable, system-of-record artifact**.

## Regulatory Interpretation Guidance
- Use AER as **supporting evidence** of adherence and clinician review.
- Do **not** treat AER as a clinical assessment or medical necessity determination.
- Treat AER as **verifiable documentation**, not a decision engine.

