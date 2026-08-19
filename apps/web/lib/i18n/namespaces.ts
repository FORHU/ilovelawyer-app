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
  "organization",
  "term",
] as const

export type Namespace = (typeof NAMESPACES)[number]
