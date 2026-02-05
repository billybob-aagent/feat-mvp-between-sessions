# Between Sessions  
**Clinical Adherence & Outcomes Enforcement Platform**

Between Sessions is a clinician-guided digital infrastructure that **tracks and documents between-session adherence** in structured behavioral health programs (IOP, PHP, OP).

It is designed to help clinics:
- Standardize prescribed interventions and due dates
- Capture between-session responses and check-ins
- Record audit trails for key clinical actions
- Support compliance review and engagement reporting with traceable evidence

This is **not** a therapy replacement, messaging app, or consumer wellness tool.  
It is **operational infrastructure** for clinical programs that require measurable outcomes.

---

## Documentation

- **AER Spec v1 (Public):** [./docs/aer/AER_SPEC_V1_PUBLIC.md](./docs/aer/AER_SPEC_V1_PUBLIC.md)  
  _Standard definition of the Adherence Evidence Report (AER): principles, domains, governance, and versioning._
- **Payer / UR Positioning:** [./docs/aer/AER_UR_POSITIONING.md](./docs/aer/AER_UR_POSITIONING.md)  
  _How AER maps to common UR/audit concerns and denial scenarios._
- **Revenue Architecture:** [./docs/strategy/REVENUE_ARCHITECTURE.md](./docs/strategy/REVENUE_ARCHITECTURE.md)  
  _Packaging and pricing logic aligned to compliance dependence._
- **Go-to-Market Kit:** [./docs/go-to-market/README.md](./docs/go-to-market/README.md)  
  _Execution kit for externalizing AER, UR validation, and pilot distribution._

These documents are the canonical references for AER standardization and commercial packaging. Implementation details may evolve, but the v1 spec is forward-compatible.

---

## Problem We Solve

Behavioral health programs depend on **between-session engagement** (assignments, skills practice, reflections), yet:

- Adherence is inconsistently tracked
- Engagement evidence is fragmented or manual
- Dropouts are detected too late
- Clinics struggle to defend engagement during audits or payer reviews

Most systems track sessions.  
**Very few systems enforce what happens between them.**

---

## What Between Sessions Does

Between Sessions provides a closed-loop workflow that ensures prescribed interventions are:

1. Assigned by clinicians  
2. Delivered and reminded by the system  
3. Completed via structured responses and check-ins  
4. Logged with timestamps and audit records  
5. Reviewable by clinicians and admins  

This creates **traceable clinical engagement**, not anecdotal notes.

---

## Core Capabilities

### Prescribed Interventions
Clinicians assign structured between-session interventions (e.g., worksheets, reflections, skill practice).

- Time-bound (due dates)
- Clinic-specific and client-specific
- Auditable via audit logs

### Adherence Tracking
Client activity is recorded as timestamped events:
- Assignment responses (text, mood, optional voice keys)
- Review state (reviewed, flagged, starred)
- Mood check-ins

### Reminders & Visibility
Assignments support:
- Manual reminders from clinicians
- Due-soon reminder service (24-hour window; requires a scheduler/worker)
- Notification records stored per user (email sending is stubbed in this build)

### Clinical Feedback Loop
Clinicians review responses and provide structured feedback, closing the loop between prescription and client response.

### Audit-Ready Evidence
Key actions are logged with actor and timestamp metadata (assignments, reminders, library actions, and more).

---

## Who This Is For

**Primary buyers**
- IOP / PHP / structured OP clinics
- Program directors
- Compliance and operations teams

**Secondary users**
- Clinicians
- Case managers
- Clinical supervisors

**End users**
- Clients enrolled in structured programs

---

## What This Is Not

- Not a messaging or chat therapy platform  
- Not a consumer mental health app  
- Not a journaling or mood-tracking tool  
- Not an EHR replacement  

Between Sessions complements existing EHRs by covering what they typically miss.

---

## Architecture Overview

### Frontend
- Next.js (App Router)
- Tailwind CSS + custom global styles
- Marketing pages (home, pricing, privacy, terms, auth)
- Application shell for clinic, therapist, client, and admin workflows

### Backend
- NestJS API
- Prisma ORM (PostgreSQL)
- Modular domain architecture (wired in `backend/src/app.module.ts`), including:
  - Clinics / Admin
  - Auth, invites, and access control
  - Prompts and assignments
  - Clients and responses
  - Feedback
  - Check-ins
  - Notifications & reminders
  - Audit logging
  - Clinical library

### Clinical Content Ingestion
- Structured ingestion pipeline for clinical PDFs
- Creates collections, versioned items, and text chunks for library search

---

## Compliance & Data Integrity

Between Sessions is built with **compliance alignment** in mind:

- Role-based access controls (JWT + roles guard)
- Audit logs for key actions
- Encrypted fields for responses, check-in notes, and notification payloads (AES-GCM)
- Environment-based configuration for regulated deployments

> Final compliance posture (HIPAA / BAA requirements) depends on deployment configuration, hosting environment, and operational controls.

---

## AI Assistants (LLM)

The backend includes two clinician-facing AI assistants that are **draft-only** and always require human review:

- `POST /api/v1/ai/adherence-assist` (LLM-1, purpose: ADHERENCE_REVIEW)
- `POST /api/v1/ai/assessment-assist` (LLM-2, purpose: DOCUMENTATION)

Safety enforcement (mandatory):
- Access is restricted to authenticated clinic admins/therapists; no client access.
- Requests flow through the AI Safety Gateway (policy + redaction + audit logging).
- Outputs are drafts only and never diagnose, treat, or recommend care.
- Retrieval grounding uses **approved clinical library content** only; when none is found the response states "No approved sources found."

Provider configuration:
- Default provider is deterministic **MOCK** (same input -> same output).
- Optional OpenAI provider is disabled unless `AI_PROVIDER=openai` and `OPENAI_API_KEY` are set.
- If a real provider is selected but misconfigured, the API returns a safe `503`.

---

## Development Setup

### Requirements
- Node.js 20+
- PostgreSQL (local or container)

### Install
From repo root:
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### Run (local)
Backend:
```bash
npm --prefix backend run start:dev
```

Frontend:
```bash
npm --prefix frontend run dev
```

By default, the frontend runs on `http://localhost:3000` (or the next available port) and the backend runs on `http://localhost:4000/api/v1` (see `backend/src/main.ts` for the global prefix).
