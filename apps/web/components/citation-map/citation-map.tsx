import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTheme } from 'next-themes';
import { AlertTriangle, ExternalLink, Loader2, Maximize, Minus, Plus, Target, Workflow, X } from 'lucide-react';
import { useCitationMapQuery, useExpandCitationMutation, useCitationEdgesQuery } from '@/lib/citation-map/mutations';
import type { CitationTreatment } from '@/lib/citation-map/types';
import type { GraphNode, GraphLink } from './types';
import { ROOT_COLOR, STATUS_COLORS, TREATMENT_COLORS, CITATION_TYPE_COLORS, UNRESOLVED_COLOR, NODE_RADIUS_BY_DEPTH, MAX_DEPTH } from './constants';

// Above this many client-observed polls (~90s at 3s/poll) we treat the job as abandoned rather
// than spinning forever — mirrors useCitationEdgesQuery's own MAX_POLLS backstop, since a
// crashed backend job never flips status to DONE on its own.
const POLL_TIMEOUT_COUNT = 28;

interface CitationMapProps {
  caseId: string;
}

const FALLBACK_RADIUS = 4.5;

function radiusFor(depth: number): number {
  return NODE_RADIUS_BY_DEPTH[depth] ?? FALLBACK_RADIUS;
}

function truncate(label: string, max = 30): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function CitationMap({ caseId }: CitationMapProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  const seedQuery = useCitationMapQuery(caseId);
  const expandMutation = useExpandCitationMutation();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [depthByLawId, setDepthByLawId] = useState<Map<string, number>>(new Map());
  const [expandedLawIds, setExpandedLawIds] = useState<Set<string>>(new Set());
  const [expandingLawId, setExpandingLawId] = useState<string | null>(null);
  const [timedOutLawId, setTimedOutLawId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pollCountRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err: unknown) => {
        console.error('Error attempting to enable full-screen mode:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
      // Container resize (fullscreen swaps it to fill the viewport) is already picked up by the
      // ResizeObserver below, but the graph itself needs an explicit re-fit — it doesn't re-run
      // its own layout just because its canvas got bigger.
      setTimeout(() => fgRef.current?.zoomToFit(400, 40), 120);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const zoomIn = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoom(fg.zoom() * 1.4, 300);
  }, []);

  const zoomOut = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoom(fg.zoom() / 1.4, 300);
  }, []);

  const recenter = useCallback(() => {
    fgRef.current?.zoomToFit(400, 40);
  }, []);

  // react-force-graph-2d doesn't reliably auto-size to its parent in this app's layout (same
  // gotcha already worked around in mind-map-3d.tsx) — without explicit width/height it can
  // measure a 0x0 container on first mount and never recover, rendering an empty canvas even
  // with real data. ResizeObserver (rather than mind-map-3d.tsx's window-resize-only listener)
  // since a Terminal panel can be dragged/resized independently of the window.
  const [dims, setDims] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) setDims({ width: clientWidth, height: clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const edgesQuery = useCitationEdgesQuery(expandingLawId ?? '', !!expandingLawId);

  // Builds the seed tier (case node + its own tracked citations) once per case.
  useEffect(() => {
    if (!seedQuery.data) return;
    const caseNodeId = `case:${seedQuery.data.caseId}`;
    const seedNodes: GraphNode[] = [{ id: caseNodeId, label: 'This Case', kind: 'case', depth: 0, color: ROOT_COLOR }];
    const seedLinks: GraphLink[] = [];
    const depths = new Map<string, number>();

    seedQuery.data.citations.forEach((citation) => {
      const node: GraphNode = citation.resolved
        ? {
            id: `law:${citation.resolved.lawId}`,
            label: citation.resolved.caseNumber || citation.resolved.title,
            kind: 'law',
            depth: 1,
            color: STATUS_COLORS[citation.status] ?? UNRESOLVED_COLOR,
            lawId: citation.resolved.lawId,
            jurisUrl: citation.resolved.jurisUrl,
            pdfUrl: citation.resolved.pdfUrl,
            caseNumber: citation.resolved.caseNumber,
            status: citation.status,
          }
        : {
            id: `raw:seed:${citation.id}`,
            label: citation.citedReference || 'Unresolved citation',
            kind: 'raw',
            depth: 1,
            color: UNRESOLVED_COLOR,
            status: citation.status,
          };

      if (citation.resolved) depths.set(citation.resolved.lawId, 1);
      seedNodes.push(node);
      seedLinks.push({ source: caseNodeId, target: node.id });
    });

    setNodes(seedNodes);
    setLinks(seedLinks);
    setDepthByLawId(depths);
    setExpandedLawIds(new Set());
    setSelectedId(null);
  }, [seedQuery.data]);

  // Merges a finished expansion's edges into the graph once, then clears expandingLawId.
  useEffect(() => {
    if (!expandingLawId) return;
    if (edgesQuery.data?.status !== 'DONE') return;

    const parentLawId = expandingLawId;
    const parentDepth = depthByLawId.get(parentLawId) ?? 1;
    const childDepth = parentDepth + 1;
    const parentNodeId = `law:${parentLawId}`;
    const edges = edgesQuery.data.edges;

    setNodes((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const additions: GraphNode[] = [];
      edges.forEach((edge, i) => {
        if (edge.toLawId && edge.toLaw) {
          const id = `law:${edge.toLawId}`;
          if (existingIds.has(id)) return;
          additions.push({
            id,
            label: edge.toLaw.caseNumber || edge.toLaw.title,
            kind: 'law',
            depth: childDepth,
            color: edge.citationType
              ? CITATION_TYPE_COLORS[edge.citationType] ?? UNRESOLVED_COLOR
              : TREATMENT_COLORS[edge.treatment as CitationTreatment] ?? UNRESOLVED_COLOR,
            lawId: edge.toLawId,
            jurisUrl: edge.toLaw.jurisUrl,
            pdfUrl: edge.toLaw.pdfUrl,
            caseNumber: edge.toLaw.caseNumber,
            treatment: edge.treatment,
            citationType: edge.citationType,
            excerpt: edge.excerpt,
          });
          existingIds.add(id);
        } else {
          const id = `raw:${parentLawId}:${i}`;
          additions.push({
            id,
            label: edge.toRawTitle || edge.toRawReference || 'Unresolved citation',
            kind: 'raw',
            depth: childDepth,
            color: UNRESOLVED_COLOR,
            treatment: edge.treatment,
            citationType: edge.citationType,
            excerpt: edge.excerpt,
          });
        }
      });
      return [...prev, ...additions];
    });

    setLinks((prev) => [
      ...prev,
      ...edges.map((edge, i) => ({
        source: parentNodeId,
        target: edge.toLawId ? `law:${edge.toLawId}` : `raw:${parentLawId}:${i}`,
      })),
    ]);

    setDepthByLawId((prev) => {
      const next = new Map(prev);
      edges.forEach((edge) => {
        if (edge.toLawId && !next.has(edge.toLawId)) next.set(edge.toLawId, childDepth);
      });
      return next;
    });

    setExpandedLawIds((prev) => new Set(prev).add(parentLawId));
    setExpandingLawId(null);
    pollCountRef.current = 0;
  }, [edgesQuery.data, expandingLawId, depthByLawId]);

  // Client-side give-up: the backend queue's own MAX_POLLS eventually stops refetching too,
  // but nothing flips status to DONE for an interrupted job, so this is what actually ends
  // the spinner and lets the user retry instead of waiting forever.
  useEffect(() => {
    if (!expandingLawId) {
      pollCountRef.current = 0;
      return;
    }
    if (edgesQuery.data?.status === 'DONE') return;
    pollCountRef.current += 1;
    if (pollCountRef.current >= POLL_TIMEOUT_COUNT) {
      setTimedOutLawId(expandingLawId);
      setExpandingLawId(null);
      pollCountRef.current = 0;
    }
    // Deliberately keyed on dataUpdatedAt (changes each poll tick), not edgesQuery.data itself —
    // this effect's job is to count ticks, the merge effect above handles the data.
  }, [edgesQuery.dataUpdatedAt, expandingLawId, edgesQuery.data?.status]);

  const handleExpand = useCallback(
    (node: GraphNode) => {
      if (!node.lawId || expandingLawId) return;
      setTimedOutLawId(null);
      setExpandingLawId(node.lawId);
      expandMutation.mutate(node.lawId);
    },
    [expandingLawId, expandMutation],
  );

  const graphData = useMemo(() => ({ nodes, links: links.map((l) => ({ ...l })) }), [nodes, links]);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const radius = radiusFor(n.depth);

      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, radius, 0, 2 * Math.PI, false);
      if (n.kind === 'raw') {
        ctx.setLineDash([2, 2]);
        ctx.fillStyle = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.25)';
        ctx.fill();
        ctx.strokeStyle = UNRESOLVED_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = n.color;
        ctx.fill();
        if (n.id === selectedId) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = isDark ? '#f8fafc' : '#111827';
          ctx.stroke();
        }
      }

      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${n.kind === 'case' ? 'bold ' : ''}${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isDark ? '#e5e7eb' : '#1f2937';
      ctx.fillText(truncate(n.label), n.x ?? 0, (n.y ?? 0) + radius + 2);
    },
    [isDark, selectedId],
  );

  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const n = node as GraphNode;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x ?? 0, n.y ?? 0, radiusFor(n.depth), 0, 2 * Math.PI, false);
    ctx.fill();
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const isExpandingSelected = !!selectedNode?.lawId && expandingLawId === selectedNode.lawId;
  const canExpandSelected =
    !!selectedNode?.lawId && selectedNode.depth < MAX_DEPTH && !expandedLawIds.has(selectedNode.lawId);
  const openUrl = selectedNode ? selectedNode.pdfUrl || selectedNode.jurisUrl : null;

  if (seedQuery.isLoading) {
    return (
      <div className="flex h-full min-h-[320px] w-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (seedQuery.isError) {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
        <p className="text-sm">Couldn&apos;t load the citation map.</p>
      </div>
    );
  }

  if (!seedQuery.data || seedQuery.data.citations.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground px-6">
        <Workflow className="h-6 w-6 opacity-50" />
        <p className="text-sm">No tracked citations on this case yet — check a citation in Law &amp; Precedent first.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-[320px] w-full overflow-hidden border border-border bg-background ${isFullScreen ? 'rounded-none border-none' : 'rounded-2xl'}`}
    >
      <ForceGraph2D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        graphData={graphData}
        nodeId="id"
        nodeLabel={(node: any) => (node as GraphNode).label}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={() => (isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.4)')}
        onNodeClick={(node: any) => setSelectedId((node as GraphNode).id)}
        onBackgroundClick={() => setSelectedId(null)}
        cooldownTicks={100}
        backgroundColor="transparent"
      />

      <div className="absolute top-3 left-3 z-20">
        <button
          type="button"
          onClick={toggleFullScreen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 backdrop-blur-xl px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground shadow-lg hover:bg-muted transition-colors"
        >
          <Maximize size={12} />
          <span className="hidden sm:inline">{isFullScreen ? 'Exit' : 'Full'}</span>
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-20 flex flex-col overflow-hidden rounded-lg border border-border bg-card/95 backdrop-blur-xl shadow-lg">
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In"
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-b border-border"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out"
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-b border-border"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={recenter}
          title="Recenter"
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Target size={14} />
        </button>
      </div>

      {selectedNode && (
        <div className="absolute inset-x-4 bottom-4 md:inset-auto md:top-4 md:right-4 md:w-[300px] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold leading-tight text-foreground">{selectedNode.label}</h4>
            <button onClick={() => setSelectedId(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>

          {(selectedNode.status || selectedNode.citationType || selectedNode.treatment) && (
            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${selectedNode.color}20`, color: selectedNode.color }}>
              {selectedNode.citationType ?? selectedNode.treatment ?? selectedNode.status}
            </span>
          )}

          {selectedNode.excerpt && <p className="text-xs text-muted-foreground leading-relaxed">&ldquo;{selectedNode.excerpt}&rdquo;</p>}

          {selectedNode.kind === 'raw' && (
            <p className="text-[11px] text-muted-foreground italic">Not found in our jurisprudence database.</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-[11px] font-bold text-brand-navy-950 hover:scale-105 transition-transform"
              >
                <ExternalLink size={12} /> Open Source
              </a>
            )}
            {canExpandSelected && (
              <button
                onClick={() => handleExpand(selectedNode)}
                disabled={isExpandingSelected}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
              >
                {isExpandingSelected ? <Loader2 size={12} className="animate-spin" /> : <Workflow size={12} />}
                {isExpandingSelected ? 'Extracting…' : 'Expand Citations'}
              </button>
            )}
          </div>

          {timedOutLawId === selectedNode.lawId && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">Extraction is taking longer than expected — try again.</p>
          )}
        </div>
      )}
    </div>
  );
}
