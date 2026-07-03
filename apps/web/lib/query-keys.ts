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
}

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
}

export const chatKeys = {
  all: ["chat"] as const,
  session: () => [...chatKeys.all, "session"] as const,
  messages: (conversationId: string) => [...chatKeys.all, "messages", conversationId] as const,
}

export const legalRagKeys = {
  all: ["legal-rag"] as const,
  lists: () => [...legalRagKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...legalRagKeys.lists(), filters] as const,
  details: () => [...legalRagKeys.all, "detail"] as const,
  detail: (id: string | number) => [...legalRagKeys.details(), String(id)] as const,
}