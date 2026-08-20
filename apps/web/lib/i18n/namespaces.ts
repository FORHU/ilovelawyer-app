export const NAMESPACES = [
  "common",
  "auth",
  "landing",
  "homepage",
  "calendar",
  "case-portfolio",
  "create-case",
  "document-analysis",
  "library",
  "transcription",
  "profile",
  "term",
  "terminal",
] as const

export type Namespace = (typeof NAMESPACES)[number]
