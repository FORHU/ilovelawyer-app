export const NAMESPACES = [
  "common",
  "auth",
  "landing",
  "homepage",
  "calendar",
  "client-request",
  "case-portfolio",
  "create-case",
  "library",
  "transcription",
  "profile",
  "organization",
  "term",
  "terminal",
  "tour",
] as const

export type Namespace = (typeof NAMESPACES)[number]
