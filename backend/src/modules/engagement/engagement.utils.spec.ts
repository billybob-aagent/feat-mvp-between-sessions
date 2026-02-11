import { ResponseCompletionStatus, SupervisorEscalationReason } from "@prisma/client";
import {
  deriveEngagementTransitions,
  getEscalationDecision,
  summarizeEngagement,
  EngagementThresholds,
  shouldSendFirstNudge,
} from "./engagement.utils";

const baseThresholds: EngagementThresholds = {
  firstNudgeHours: 24,
  partialGraceHours: 24,
  escalationOverdueHours: 48,
  partialEscalationCount: 2,
  highRiskPartialCount: 2,
};

describe("engagement utils", () => {
  it("transitions pending to overdue when due date passes with no responses", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const dueDate = new Date("2026-02-05T00:00:00.000Z");
    const now = new Date("2026-02-06T12:00:00.000Z");

    const summary = summarizeEngagement({
      createdAt,
      publishedAt: null,
      dueDate,
      responses: [],
      clinicTimezone: "UTC",
      now,
      thresholds: baseThresholds,
    });

    expect(summary.state).toBe("overdue");

    const transitions = deriveEngagementTransitions({ summary, now, thresholds: baseThresholds });
    expect(transitions).toEqual([
      expect.objectContaining({ from: "pending", to: "overdue" }),
    ]);
  });

  it("transitions pending to partial to completed", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const dueDate = new Date("2026-02-10T00:00:00.000Z");
    const now = new Date("2026-02-03T12:00:00.000Z");
    const responses = [
      {
        createdAt: new Date("2026-02-02T09:00:00.000Z"),
        completionStatus: ResponseCompletionStatus.PARTIAL,
      },
      {
        createdAt: new Date("2026-02-03T10:00:00.000Z"),
        completionStatus: ResponseCompletionStatus.COMPLETED,
      },
    ];

    const summary = summarizeEngagement({
      createdAt,
      publishedAt: null,
      dueDate,
      responses,
      clinicTimezone: "UTC",
      now,
      thresholds: baseThresholds,
    });

    expect(summary.state).toBe("completed");

    const transitions = deriveEngagementTransitions({ summary, now, thresholds: baseThresholds });
    expect(transitions.map((t) => t.to)).toEqual(["partial", "completed"]);
  });

  it("transitions partial to overdue after grace window", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const dueDate = new Date("2026-02-03T00:00:00.000Z");
    const now = new Date("2026-02-05T00:00:00.000Z");
    const responses = [
      {
        createdAt: new Date("2026-02-02T09:00:00.000Z"),
        completionStatus: ResponseCompletionStatus.PARTIAL,
      },
    ];

    const summary = summarizeEngagement({
      createdAt,
      publishedAt: null,
      dueDate,
      responses,
      clinicTimezone: "UTC",
      now,
      thresholds: baseThresholds,
    });

    expect(summary.state).toBe("overdue");
    const transitions = deriveEngagementTransitions({ summary, now, thresholds: baseThresholds });
    expect(transitions.map((t) => t.to)).toEqual(["partial", "overdue"]);
  });

  it("triggers escalation when overdue past threshold with no activity", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const dueDate = new Date("2026-02-02T00:00:00.000Z");
    const now = new Date("2026-02-05T00:00:00.000Z");

    const summary = summarizeEngagement({
      createdAt,
      publishedAt: null,
      dueDate,
      responses: [],
      clinicTimezone: "UTC",
      now,
      thresholds: baseThresholds,
    });

    const decision = getEscalationDecision({ summary, now, thresholds: baseThresholds });
    expect(decision).toEqual({
      reason: SupervisorEscalationReason.NO_ACTIVITY,
      trigger: "overdue",
    });
  });

  it("triggers escalation when partial attempts exceed threshold", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const dueDate = new Date("2026-02-10T00:00:00.000Z");
    const now = new Date("2026-02-03T00:00:00.000Z");
    const responses = [
      {
        createdAt: new Date("2026-02-02T09:00:00.000Z"),
        completionStatus: ResponseCompletionStatus.PARTIAL,
      },
      {
        createdAt: new Date("2026-02-02T12:00:00.000Z"),
        completionStatus: ResponseCompletionStatus.PARTIAL,
      },
    ];

    const summary = summarizeEngagement({
      createdAt,
      publishedAt: null,
      dueDate,
      responses,
      clinicTimezone: "UTC",
      now,
      thresholds: baseThresholds,
    });

    const decision = getEscalationDecision({ summary, now, thresholds: baseThresholds });
    expect(decision).toEqual({
      reason: SupervisorEscalationReason.LOW_COMPLETION,
      trigger: "partial",
    });
  });

  it("sends first nudge after inactivity window", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const now = new Date("2026-02-02T12:00:00.000Z");

    const summary = summarizeEngagement({
      createdAt,
      publishedAt: null,
      dueDate: null,
      responses: [],
      clinicTimezone: "UTC",
      now,
      thresholds: baseThresholds,
    });

    expect(shouldSendFirstNudge({ summary, now, thresholds: baseThresholds })).toBe(true);
  });
});
