export type ClinicDashboard = {
  clinic: {
    id: string;
    name: string;
    timezone: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  counts: {
    therapists: number;
    clients: number;
    assignments: number;
    responses: number;
    checkinsLast7d: number;
  };
};

export type ClinicTherapistListItem = {
  id: string;
  fullName: string;
  email: string;
  isDisabled: boolean;
  organization: string | null;
  timezone: string;
  createdAt: string;
  clientCount: number;
  assignmentCount: number;
};

export type ClinicTherapistDetail = {
  id: string;
  fullName: string;
  email: string;
  isDisabled: boolean;
  organization: string | null;
  timezone: string;
  createdAt: string;
  clientCount: number;
  assignmentCount: number;
  responseCount: number;
  lastAssignmentAt: string | null;
  lastResponseAt: string | null;
};

export type ClinicTherapistInvite = {
  token: string;
  expiresAt: string | null;
};

export type ClinicTherapistCreateResult = {
  id: string | null;
  fullName: string | null;
  email: string;
};

export type ClinicClientListItem = {
  id: string;
  fullName: string;
  email: string;
  therapistId: string;
  therapistName: string | null;
  createdAt: string;
  assignmentCount: number;
  responseCount: number;
  checkinCount: number;
};

export type ClinicClientDetail = {
  id: string;
  fullName: string;
  email: string;
  therapistId: string;
  therapistName: string | null;
  createdAt: string;
  assignmentCount: number;
  responseCount: number;
  checkinCount: number;
  lastCheckinAt: string | null;
};

export type ClinicAssignmentListItem = {
  id: string;
  title: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  publishedAt: string | null;
  therapistId: string;
  therapistName: string | null;
  clientId: string;
  clientName: string | null;
  responseCount: number;
};

export type ClinicResponseListItem = {
  id: string;
  assignmentId: string;
  assignmentTitle: string | null;
  clientId: string;
  clientName: string | null;
  therapistId: string;
  therapistName: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
  flaggedAt: string | null;
  hasTherapistNote: boolean;
  voiceStorageKey: string | null;
};

export type ClinicCheckinListItem = {
  id: string;
  clientId: string;
  clientName: string | null;
  therapistId: string;
  therapistName: string | null;
  mood: number;
  createdAt: string;
};

export type ClinicBilling = {
  clinicId: string;
  status: string;
};

export type ClinicSettings = {
  ok: true;
  clinic: {
    id: string;
    name: string;
    timezone: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
};
