import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

// react-force-graph-2d touches canvas/window at import time — same reason mind-map-3d.tsx
// is dynamically imported with ssr:false.
const CitationMapGraph = dynamic(() => import('./citation-map').then((m) => m.CitationMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] w-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
});

export interface CitationMapPanelProps {
  caseId: string;
}

/** Citation Map covers PH (juris.ph) and UK (UK Legal MCP, called directly per citation — no
 * ingested corpus needed, unlike Law Search which stays PH-only pending one). Every other
 * tenantCode gets the same "not available" copy as law-search-panel.tsx's PH-only gate. */
export function CitationMap({ caseId }: CitationMapPanelProps) {
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode);

  if (tenantCode !== 'PH' && tenantCode !== 'UK') {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground px-6">
        <p className="text-sm">Citation Map is not available for this jurisdiction.</p>
      </div>
    );
  }

  return <CitationMapGraph caseId={caseId} />;
}
