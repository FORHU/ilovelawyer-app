import type { SVGProps } from "react";

/** The 18 hand-drawn feature-grid icons from the redesign handoff, extracted from
 * `ilovelawyer Website v2.dc.html` (§3 Feature grid). 24x24 viewBox, stroke-width 1.6,
 * round cap/join, rendered at 22x22 by the feature grid — matches the handoff exactly
 * rather than mapping onto the closest lucide-react icon. */

const defaultProps: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const featureIcons = {
  accountsSignIn: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.8 3.2-6 7-6s7 2.2 7 6" />
    </svg>
  ),
  firmsTeams: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M3.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5" />
      <circle cx="16" cy="8" r="2.6" />
      <path d="M11.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5" />
    </svg>
  ),
  twoJurisdictions: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3c2.5 2.5 2.5 15.5 0 18" />
      <path d="M12 3c-2.5 2.5-2.5 15.5 0 18" />
    </svg>
  ),
  aiLegalConsultation: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <path d="M8 20l3-4" />
    </svg>
  ),
  caseFiles: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" />
    </svg>
  ),
  caseWorkspace: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  ),
  legalTerminal: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10l3 2-3 2" />
      <line x1="12" y1="14" x2="16" y2="14" />
    </svg>
  ),
  researchLibrary: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <path d="M4 5.5c2.6-1 5.4-1 8 0v13c-2.6-1-5.4-1-8 0v-13z" />
      <path d="M20 5.5c-2.6-1-5.4-1-8 0v13c2.6-1 5.4-1 8 0v-13z" />
    </svg>
  ),
  transcription: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  ),
  documentUpload: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <line x1="12" y1="16" x2="12" y2="4" />
      <path d="M8 8l4-4 4 4" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  ),
  calendar: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  ),
  visualStrategyMap: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <circle cx="6" cy="6" r="1.8" />
      <circle cx="18" cy="6" r="1.8" />
      <circle cx="12" cy="13" r="1.8" />
      <circle cx="6" cy="20" r="1.8" />
      <circle cx="18" cy="20" r="1.8" />
      <line x1="6" y1="7.8" x2="11" y2="11.6" />
      <line x1="18" y1="7.8" x2="13" y2="11.6" />
      <line x1="11" y1="14.6" x2="6.8" y2="18.4" />
      <line x1="13" y1="14.6" x2="17.2" y2="18.4" />
    </svg>
  ),
  evidenceTimeline: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  ),
  redTeam: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <path d="M12 3l8 4v6c0 5-4 7-8 8-4-1-8-3-8-8V7l8-4z" />
    </svg>
  ),
  audioOverview: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <rect x="4" y="10" width="2" height="5" />
      <rect x="9" y="6" width="2" height="13" />
      <rect x="14" y="8" width="2" height="9" />
      <rect x="19" y="11" width="2" height="4" />
    </svg>
  ),
  citationChecking: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  ),
  contradictionScan: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <path d="M12 3l9 16H3L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  threeLanguages: (props: SVGProps<SVGSVGElement>) => (
    <svg {...defaultProps} {...props}>
      <path d="M4 6h9" />
      <line x1="8.5" y1="4" x2="8.5" y2="6" />
      <path d="M6.5 6c.8 3 2.6 5 5.5 6.2" />
      <path d="M4 14l4-3.6" />
      <line x1="14" y1="9" x2="13" y2="20" />
      <path d="M11 20h9" />
      <path d="M17 15l3 2.5-3 2.5" />
    </svg>
  ),
} as const;

export type FeatureIconKey = keyof typeof featureIcons;
