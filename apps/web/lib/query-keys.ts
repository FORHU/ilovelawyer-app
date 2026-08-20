export const lawyerKeys = {
  all: ["lawyers"] as const,
  lists: () => [...lawyerKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...lawyerKeys.lists(), filters] as const,
  details: () => [...lawyerKeys.all, "detail"] as const,
  detail: (id: string) => [...lawyerKeys.details(), id] as const,
}

export const caseKeys = {
  all: ["cases"] as const,
  lists: () => [...caseKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, "detail"] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
  timelines: () => [...caseKeys.all, "timeline"] as const,
  timeline: (id: string) => [...caseKeys.timelines(), id] as const,
}

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  details: () => [...organizationKeys.all, "detail"] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
  members: (id: string) => [...organizationKeys.detail(id), "members"] as const,
}

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
}

export const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
}

export const chatKeys = {
  all: ["chat"] as const,
  session: () => [...chatKeys.all, "session"] as const,
  // Broad key (no caseId segment) — use for invalidation so both the unfiltered list and
  // every per-case list get refetched together, since any consultation could show up in
  // either depending on where it lives.
  consultationsAll: () => [...chatKeys.all, "consultations"] as const,
  consultations: (caseId?: string) => [...chatKeys.consultationsAll(), caseId ?? null] as const,
  messages: (consultationId: string) => [...chatKeys.all, "messages", consultationId] as const,
  relatedCases: (consultationId: string) => [...chatKeys.all, "related-cases", consultationId] as const,
  documents: (consultationId: string) => [...chatKeys.all, "documents", consultationId] as const,
}

export const appointmentKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentKeys.all, "list"] as const,
  list: (range: { from: string; to: string }) => [...appointmentKeys.lists(), range] as const,
}

export const noteKeys = {
  all: ["notes"] as const,
  lists: () => [...noteKeys.all, "list"] as const,
  list: (range: { from: string; to: string }) => [...noteKeys.lists(), range] as const,
}

export const transcriptionKeys = {
  all: ["transcriptions"] as const,
  lists: () => [...transcriptionKeys.all, "list"] as const,
  details: () => [...transcriptionKeys.all, "detail"] as const,
  detail: (id: string) => [...transcriptionKeys.details(), id] as const,
}

export const legalRagKeys = {
  all: ["legal-rag"] as const,
  lists: () => [...legalRagKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...legalRagKeys.lists(), filters] as const,
  details: () => [...legalRagKeys.all, "detail"] as const,
  detail: (id: string | number) => [...legalRagKeys.details(), String(id)] as const,
  sections: () => [...legalRagKeys.all, "sections"] as const,
}