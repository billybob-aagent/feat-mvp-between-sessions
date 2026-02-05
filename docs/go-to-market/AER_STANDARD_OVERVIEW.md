# AER Standard Overview (v1.0)

## Purpose
AER is a standardized, period-stable evidence artifact that documents between-session adherence in structured behavioral health programs.

## Scope
- Evidence of assigned interventions and client responses
- Deterministic timelines of adherence events
- Auditability and traceability of actions

## What It Is
- A deterministic report built from system-of-record events
- A compliance artifact for audits and utilization review

## What It Is Not
- A diagnostic tool
- A treatment recommendation engine
- A replacement for clinician review

## Core Principles
- Determinism
- Period stability (date-only)
- Evidence traceability
- Human-in-the-loop review
- Auditability

## Consumption
- JSON as the primary artifact
- Deterministic PDF as secondary format

## Implementation Notes
- Missing data must be explicitly flagged (no inference)
- All timestamps and actors must be attributable
- External access is read-only and time-limited
