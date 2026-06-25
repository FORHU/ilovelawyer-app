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
