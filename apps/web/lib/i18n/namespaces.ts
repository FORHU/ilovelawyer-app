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
  // English only for now, like "tour" — i18next's fallbackLng covers ko/tl until this gets
  // translated. UK-tenant-only feature (see config/tenant-codes/uk.ts's "clientRequests").
  "client-requests",
] as const

export type Namespace = (typeof NAMESPACES)[number]
