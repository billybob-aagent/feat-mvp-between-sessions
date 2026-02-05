# AER Go-To-Market Execution Kit

This folder contains a structured, compliance-oriented execution kit for externalizing AER, validating payer fit, and running distribution pilots before expanding AI scope.

## Contents

### Step 1 -- Externalize AER as a Standard
- `STEP_1_EXTERNALIZE_AER_STANDARD.md` -- execution plan and responsibilities.
- `AER_STANDARD_OVERVIEW.md` -- concise standard overview for external distribution.
- `AER_CONFORMANCE_CHECKLIST.md` -- conformance and auditability checklist.

### Step 2 -- Payer & UR Reality Check
- `STEP_2_UR_REALITY_CHECK.md` -- execution plan and goals.
- `AER_UR_REVIEWER_PACKET.md` -- UR-facing packet with denial mapping.
- `UR_REALITY_CHECK_SCRIPT.md` -- 10-question interviewer script.
- `UR_FEEDBACK_FORM.md` -- structured scoring form with free-text capture.

### Step 3 -- Distribution Before More Intelligence
- `STEP_3_DISTRIBUTION_PILOT.md` -- pilot execution plan and governance.
- `PILOT_30_DAY_PLAN.md` -- week-by-week milestones.
- `PILOT_SUCCESS_METRICS.md` -- success metrics and targets.
- `PILOT_EMAIL_TEMPLATES.md` -- pilot outreach and follow-up templates.

### Audit Submission Example
- `AER_AUDIT_SUBMISSION_EXAMPLE.md` -- realistic redacted example of an AER submission artifact.

## How to Use
1. Distribute the Step 1 docs to compliance and payer-facing stakeholders.
2. Use Step 2 scripts and forms during UR interviews and debriefs.
3. Execute Step 3 pilots before expanding AI features or additional clinical modules.
4. Generate the bundled PDF with `python3 scripts/build_gtm_pdf.py`.

## PDF Bundle
The kit can be compiled into a single PDF at:
- `docs/go-to-market/out/AER_GTM_Kit.pdf`
