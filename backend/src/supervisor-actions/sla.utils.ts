import { SupervisorEscalationStatus } from "@prisma/client";

export const OVERDUE_THRESHOLD_HOURS = 72;

const roundHours = (value: number) => Number(value.toFixed(2));

export const computeSla = (params: {
  createdAt: Date;
  resolvedAt: Date | null;
  status: SupervisorEscalationStatus;
  now?: Date;
}) => {
  const now = params.now ?? new Date();
  const endTime =
    params.status === SupervisorEscalationStatus.RESOLVED && params.resolvedAt
      ? params.resolvedAt
      : now;
  const rawHours = (endTime.getTime() - params.createdAt.getTime()) / 3_600_000;
  const ageHours = roundHours(rawHours);
  const timeToResolveHours =
    params.status === SupervisorEscalationStatus.RESOLVED && params.resolvedAt
      ? ageHours
      : null;
  const overdue =
    params.status === SupervisorEscalationStatus.OPEN &&
    rawHours > OVERDUE_THRESHOLD_HOURS;

  return {
    ageHours,
    timeToResolveHours,
    overdue,
    rawHours,
  };
};
