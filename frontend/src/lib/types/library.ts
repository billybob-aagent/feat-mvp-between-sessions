export type LibraryCollection = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryItemListRow = {
  id: string;
  collectionId: string;
  slug: string;
  title: string;
  contentType: string;
  status: string;
  version: number;
  metadata: Record<string, unknown> | null;
  updatedAt: string;
};

export type LibraryItemVersion = {
  id: string;
  versionNumber: number;
  changeSummary: string | null;
  createdAt: string;
};

export type LibraryItemDecision = {
  id: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  actorUserId: string | null;
  actorRole: string;
  createdAt: string;
};

export type LibraryItemDetail = {
  id: string;
  collectionId: string;
  slug: string;
  title: string;
  contentType: string;
  metadata: Record<string, unknown> | null;
  sections: Array<Record<string, unknown>> | null;
  status: string;
  version: number;
  sourceFileName: string | null;
  importTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
  versions: LibraryItemVersion[];
  decisions?: LibraryItemDecision[];
};

export type LibrarySearchResult = {
  itemId: string;
  itemTitle: string;
  contentType: string;
  status: string;
  headingPath: string;
  snippet: string;
};

export type LibrarySearchResponse = {
  items: LibrarySearchResult[];
};

export type LibraryRagChunk = {
  itemId: string;
  itemTitle: string;
  contentType: string;
  status: string;
  headingPath: string;
  text: string;
};

export type LibraryRagResponse = {
  query: string;
  chunks: LibraryRagChunk[];
};

export type LibrarySignatureRequestListItem = {
  id: string;
  itemId: string;
  itemTitle: string;
  itemContentType: string;
  itemStatus: string;
  status: string;
  requestedAt: string;
  dueAt: string | null;
  signedAt: string | null;
};

export type LibrarySignatureRequestListResponse = {
  items: LibrarySignatureRequestListItem[];
};

export type LibraryCreateSignatureRequestResponse = {
  id: string;
  status: string;
  pdfSnapshotRef: string | null;
};

export type LibraryReviewQueueItem = {
  id: string;
  collectionId: string;
  title: string;
  slug: string;
  contentType: string;
  status: string;
  version: number;
  updatedAt: string;
  lastDecisionAt: string | null;
  lastDecisionAction: string | null;
};

export type LibraryReviewQueueResponse = {
  items: LibraryReviewQueueItem[];
};
