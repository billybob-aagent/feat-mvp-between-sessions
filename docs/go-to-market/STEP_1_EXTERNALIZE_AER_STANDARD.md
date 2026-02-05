# STEP 1 -- Externalize AER as a Standard

## Objective
Establish AER v1.0 as a stable, external standard that payers, UR teams, auditors, and compliance officers can reference without ambiguity.

## Status
**Status: Stable**
- AER v1.0 is intended to be externally referenceable.
- Minor revisions must be backward compatible.

## Deliverables
- Public AER specification (v1.0)
- Conformance checklist for implementations
- Versioning and change control policy

## Change Control and Versioning Promises
- **Backward compatibility:** existing fields will never be removed or renamed in v1.x.
- **Additive changes only:** new fields can be added if marked optional.
- **Deprecation:** any deprecation requires explicit notice and a defined sunset period.
- **Version pinning:** the report version is embedded in output.

## Execution Steps
1. Publish the public AER v1.0 spec.
2. Provide the conformance checklist to internal engineering and compliance.
3. Validate production output against the checklist.
4. Share the spec with a small set of external stakeholders for review.

## Ownership
- Product: standard ownership and messaging discipline
- Regulatory/Compliance: conformance criteria
- Engineering: deterministic generation and audit logging

## Exit Criteria
- External stakeholders can cite AER v1.0 without interpretive gaps.
- Internal systems pass the conformance checklist.
- Any exceptions are explicitly documented in `not_available`.
