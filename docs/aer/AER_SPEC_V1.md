# Adherence Evidence Report (AER) v1

## Purpose
The Adherence Evidence Report (AER) v1 provides a deterministic, audit-oriented
JSON summary of between-session adherence for a specific client and clinic over
a defined reporting period. It is designed for compliance review, internal QA,
and outcomes documentation.

## Non-goals
- No PDF generation (JSON only in v1).
- No cross-clinic aggregation.
- No derived clinical scoring beyond what is recorded in the system.
- No assumptions about program enrollment when program data is not stored.

## Definitions
- **Prescribed Intervention**: A published assignment for a client, created by a
  clinician, with optional due dates and recurrence.
- **Adherence Event**: A timestamped system event that represents client
  engagement (response, check-in), clinician feedback, or system notification.
- **Escalation**: A reminder or follow-up action triggered by non-adherence or
  approaching due dates (tracked via notifications where available).

## Endpoint

GET `/api/v1/reports/aer/:clinicId/:clientId`

Query params:
- `start` (ISO date or ISO timestamp, optional)
- `end` (ISO date or ISO timestamp, optional)
- `program` (string, optional)

Defaults:
- If `start`/`end` are missing, the report covers the last 30 days ending today
  (server time).

## JSON Contract (AER v1)

```json
{
  "meta": {
    "report_type": "AER",
    "version": "v1",
    "generated_at": "<ISO timestamp>",
    "period": { "start": "<ISO date>", "end": "<ISO date>" },
    "clinic_id": "<clinicId>",
    "client_id": "<clientId>",
    "program": "<string|null>",
    "generated_by": { "type": "system", "id": "backend" }
  },
  "context": {
    "clinic": { "name": "<string|null>" },
    "client": { "display_id": "<string|null>" }
  },
  "prescribed_interventions": [
    {
      "assignment_id": "<string>",
      "title": "<string|null>",
      "assigned_by": { "user_id": "<string|null>", "name": "<string|null>" },
      "assigned_at": "<ISO timestamp|null>",
      "due": { "start": "<ISO timestamp|null>", "end": "<ISO timestamp|null>" },
      "completion_criteria": "<string|null>",
      "status_summary": { "completed": 0, "partial": 0, "missed": 0, "late": 0 }
    }
  ],
  "adherence_timeline": [
    {
      "ts": "<ISO timestamp>",
      "type": "assignment_completed|assignment_partial|assignment_missed|checkin|feedback|notification_sent|other",
      "source": "client|system|clinician",
      "ref": { "assignment_id": "<string|null>", "response_id": "<string|null>" },
      "details": { }
    }
  ],
  "noncompliance_escalations": [
    {
      "ts": "<ISO timestamp>",
      "type": "reminder|escalation",
      "channel": "email|sms|inapp|unknown",
      "details": { }
    }
  ],
  "clinician_review": {
    "reviewed": false,
    "reviewed_at": "<ISO timestamp|null>",
    "reviewed_by": { "user_id": "<string|null>", "name": "<string|null>" },
    "notes": "<string|null>"
  },
  "audit_integrity": {
    "data_sources": ["prisma"],
    "notes": "This report is generated from system-of-record event data where available.",
    "report_id": "<stable id string>",
    "hash": "<optional hash|null>"
  },
  "not_available": [
    "List any sections/fields that could not be populated due to missing tables/relations in the current codebase."
  ]
}
```

## Field Notes (Source of Truth)

### meta
- `generated_at`: server timestamp at generation.
- `period.start`/`period.end`: ISO date strings derived from requested date range.
- `program`: echoed from query param; no filtering is applied unless program data exists.
- `generated_by`: static value (`system` / `backend`).

### context
- `clinic.name`: from `clinics.name`.
- `client.display_id`: not stored in schema; left null with a `not_available` entry.

### prescribed_interventions
- Source: `assignments` joined to `therapists` and `prompts`.
- `assigned_by`: therapist user ID + therapist full name.
- `assigned_at`: `published_at` when present; otherwise `created_at`.
- `due.start`: `assigned_at`.
- `due.end`: `due_date`.
- `completion_criteria`: not modeled; left null and listed in `not_available`.
- `status_summary`: inferred from assignment due date and response activity
  within the requested period.

### adherence_timeline
- Responses: `responses.created_at` -> `assignment_completed` events.
- Check-ins: `checkins.created_at` -> `checkin` events.
- Feedback: `feedback.created_at` -> `feedback` events.
- Notifications: `notifications.created_at` -> `notification_sent` events.
- Assignment misses: inferred when an assignment has a `due_date` within the
  period and no response within the period.

### noncompliance_escalations
- Derived from notifications of reminder types where possible.
- Channel is `unknown` unless a delivery channel is stored.

### clinician_review
- `reviewed`: true if any response was reviewed within the period.
- `reviewed_at`/`reviewed_by`: taken from the most recent reviewed response.
- `notes`: not modeled; left null with a `not_available` entry.

### audit_integrity
- `report_id`: stable identifier:
  `AER-v1:<clinicId>:<clientId>:<start YYYY-MM-DD>:<end YYYY-MM-DD>[:<program>]`.
- `hash`: not generated in v1; left null.

## Not Available Guidance
Use `not_available` to list any fields or sections that cannot be populated due
to missing schema support. Example entries:
- `context.client.display_id (no display_id in clients table)`
- `prescribed_interventions.completion_criteria (no field in assignments/prompts)`
- `program filter (no program field to filter assignments/clients)`
- `clinician_review.notes (no review notes model)`
- `noncompliance_escalations.channel (delivery channel not stored)`
- `audit_integrity.hash (not implemented in v1)`

## Example Request

```http
GET /api/v1/reports/aer/clinic-123/client-456?start=2026-01-01&end=2026-01-31&program=IOP
```

## Example Response (placeholders)

```json
{
  "meta": {
    "report_type": "AER",
    "version": "v1",
    "generated_at": "2026-02-04T18:00:00.000Z",
    "period": { "start": "2026-01-01", "end": "2026-01-31" },
    "clinic_id": "clinic-123",
    "client_id": "client-456",
    "program": "IOP",
    "generated_by": { "type": "system", "id": "backend" }
  },
  "context": {
    "clinic": { "name": "Example Clinic" },
    "client": { "display_id": null }
  },
  "prescribed_interventions": [],
  "adherence_timeline": [],
  "noncompliance_escalations": [],
  "clinician_review": {
    "reviewed": false,
    "reviewed_at": null,
    "reviewed_by": { "user_id": null, "name": null },
    "notes": null
  },
  "audit_integrity": {
    "data_sources": ["prisma"],
    "notes": "This report is generated from system-of-record event data where available.",
    "report_id": "AER-v1:clinic-123:client-456:2026-01-01:2026-01-31:IOP",
    "hash": null
  },
  "not_available": [
    "context.client.display_id (no display_id in clients table)",
    "prescribed_interventions.completion_criteria (no field in assignments/prompts)",
    "program filter (no program field to filter assignments/clients)",
    "clinician_review.notes (no review notes model)",
    "noncompliance_escalations.channel (delivery channel not stored)",
    "audit_integrity.hash (not implemented in v1)"
  ]
}
```
