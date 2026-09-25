import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ReactDOM from 'react-dom';
import { useTheme } from 'next-themes';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Maximize, Check, Save, RotateCcw, Trash2, Plus, Minus, Target, X, Box, Monitor, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MindMapProps, MindMapItem } from './types';
import { MIND_MAP_CHROME, MIND_MAP_LIMITS, MIND_MAP_THEME, mindMapGridColor, fixedNodeDescription } from './constants';
import ReactMarkdown from 'react-markdown';
import { CustomNode } from './custom-node';
import { reconcileCollapsedIds, countDescendants, collapseBelowLevel, treeDepth, treeHasChecks } from './collapse';
import { buildMindMapGraph, MIND_MAP_PERF_THRESHOLD, type MindMapLayout } from './layout';
import { NodeEditor } from './node-editor';
import { NodeEvidence } from './node-evidence';
import type { MindMapEditRequest } from './types';
import type { MindMap3DHandle, MindMap3DProps } from './mind-map-3d';

const MindMap3D = dynamic(() => import('./mind-map-3d').then(m => m.MindMap3D), {
  ssr: false,
  loading: () => (
    <div className={MIND_MAP_CHROME.loading3d}>
      Loading mind map...
    </div>
  ),
}) as React.ForwardRefExoticComponent<MindMap3DProps & React.RefAttributes<MindMap3DHandle>>;

/** Levels open when a map is first shown (root = 0): the five branches, their points, and one
 * level of detail under each point. Saved with the collapse state (`collapseDefault`), so a map
 * whose fold was seeded under a different default is re-seeded once when this changes. */
const DEFAULT_VISIBLE_LEVELS = 3;

const nodeTypes = {
  custom: CustomNode,
};

const getInitialNodes = (): Node[] => {
  return [
    {
      id: 'root',
      type: 'custom',
      data: {
        label: 'Case Analysis',
        description: fixedNodeDescription({ isRoot: true }),
        isRoot: true,
        color: '#722f37',
        className: MIND_MAP_THEME.rootClass,
      },
      position: { x: 0, y: 0 },
    },
  ];
};

/** Where a node sits in the tree `data` — for the detail panel's "Generate more" button, which has
 * to work the same for a 2D and a 3D click (3D nodes aren't React Flow nodes). */
function locateTreeNode(root: MindMapItem, id: string | null): { item: MindMapItem; depth: number } | null {
  if (!root || !id) return null;
  const walk = (item: MindMapItem, depth: number): { item: MindMapItem; depth: number } | null => {
    if (item?.id === id) return { item, depth };
    for (const child of item?.children || item?.items || item?.nodes || item?.subnodes || item?.branches || item?.subitems || []) {
      const hit = walk(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return walk(root, 0);
}

function MindMapInner({ rootTitle = "Case Analysis", data, consultationId, isStale, staleDetail, regenerating, regeneratingLabel = 'Regenerating…', onRegenerate, expansion, documentNames }: MindMapProps) {
  const { t } = useTranslation('case-portfolio');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  const [layout, setLayout] = useState<MindMapLayout>('horizontal');
  const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [is3D, setIs3D] = useState(false);
  const mindMap3DRef = useRef<MindMap3DHandle>(null);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<any>(null);
  // Holds enriched data from 3D click (description, media) since 3D is outside React Flow
  const [selected3DNodeData, setSelected3DNodeData] = useState<any>(null);

  const { fitView, zoomIn, zoomOut, getNodes } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [slots, setSlots] = useState<({ nodes: Node[], edges: Edge[] } | null)[]>(Array(3).fill(null));

  const localStorageKey = `mind_map:${consultationId ?? 'unscoped'}`;

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  // True until this map's collapse state is settled — either the user's own, restored from the
  // cache, or the default below. Only a settled state is written back, so an empty set persisted
  // before the default lands can't later pass for "the user expanded everything".
  const [collapseDefaultPending, setCollapseDefaultPending] = useState(false);

  // Re-seeds from the *new* key's cache whenever localStorageKey changes — not just on mount —
  // since this component isn't remounted when the caller swaps consultationId (e.g. Studio's
  // thread switch), so a lazy useState initializer alone would leave stale collapse state
  // hanging around from the previous consultation.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(localStorageKey);
      const parsed = cached ? JSON.parse(cached) : null;
      if (
        parsed?.collapseSettled &&
        Array.isArray(parsed.collapsedIds) &&
        (parsed.collapseDefault ?? 2) === DEFAULT_VISIBLE_LEVELS
      ) {
        setCollapsedIds(new Set(parsed.collapsedIds));
        setCollapseDefaultPending(false);
        return;
      }
    } catch {
      // fall through to the default
    }
    setCollapsedIds(new Set());
    setCollapseDefaultPending(true);
  }, [localStorageKey]);

  // First time this map is shown here: open at root + branches + points + their detail (levels 0–3) and
  // fold everything deeper, so a 100-node map opens looking like a readable overview. The
  // Structure menu's "Show levels" and each node's toggle open the rest.
  useEffect(() => {
    if (!collapseDefaultPending || !data || typeof data !== 'object') return;
    // Has to wait for `data`, which can arrive after the cache check above — same one-shot
    // seeding as that effect, not a render loop (it clears its own trigger).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedIds(collapseBelowLevel(data, DEFAULT_VISIBLE_LEVELS));
    setCollapseDefaultPending(false);
  }, [collapseDefaultPending, data]);

  const mapDepth = useMemo(() => treeDepth(data), [data]);
  const showLevels = useCallback((level: number | null) => {
    setCollapsedIds(level === null ? new Set() : collapseBelowLevel(data, level));
    setCollapseDefaultPending(false);
    setIsLayoutMenuOpen(false);
  }, [data]);

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // "Expand with AI" (see MindMapExpansion). Limits per the Map expansion limits decision: no
  // button on the root (its five branches are fixed) or on a node at the last level; disabled
  // for the whole map once it holds MIND_MAP_LIMITS.maxNodes nodes.
  const totalNodes = useMemo(() => (data && typeof data === 'object' ? 1 + countDescendants(data) : 0), [data]);
  const expandState = useCallback(
    (node: { id: string; isRoot?: boolean; depth: number }) => {
      if (!expansion || node.isRoot || node.depth >= MIND_MAP_LIMITS.maxDepth) return null;
      const busy = expansion.expandingNodeIds.has(node.id);
      const atNodeCap = totalNodes >= MIND_MAP_LIMITS.maxNodes;
      const hint = atNodeCap
        ? t('mindMapExpand.limitNodes', { max: MIND_MAP_LIMITS.maxNodes })
        : expansion.disabledReason;
      return { busy, disabled: busy || Boolean(hint), hint };
    },
    [expansion, totalNodes, t],
  );

  // After a successful expand: open the node (it may have been collapsed) and bring its new
  // children into view once they've been laid out.
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const handleExpandNode = useCallback(async (id: string) => {
    if (!expansion) return;
    const ok = await expansion.expand(id);
    if (!ok) return;
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPendingFocusId(id);
  }, [expansion]);

  // Regenerate replaces the whole map, expansions included — say so first. Inline (not a
  // dialog) so it still shows when the map is in the browser's native fullscreen.
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const requestRegenerate = useCallback(() => {
    if (!onRegenerate) return;
    if (expansion && expansion.expandedCount > 0) setConfirmRegenerate(true);
    else onRegenerate();
  }, [expansion, onRegenerate]);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err: any) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedNodeId(null);
    setSelected3DNodeData(null);
    setPlayingAudio(null);
    if (is3D) {
      mindMap3DRef.current?.recenter();
    } else {
      fitView({ padding: 0.05, duration: 800 });
    }
  }, [is3D, fitView]);


  // Reconciles collapse state against a freshly-generated tree: node ids that persisted keep
  // their collapsed/expanded state, ids no longer present (including brand-new ones from a
  // regenerate) drop out and default to expanded. Deliberately scoped to `data` alone — must
  // not re-run on a layout switch or a collapse toggle, only on an actual new/regenerated tree.
  useEffect(() => {
    if (!data) return;
    setCollapsedIds((prev) => reconcileCollapsedIds(prev, data));
  }, [data]);

  useEffect(() => {
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      const { nodes: newNodes, edges: newEdges } = buildMindMapGraph(data, layout, collapsedIds, rootTitle);
      setNodes(newNodes);
      setEdges(newEdges);

      // Persist the state to survive refreshes
      try {
        localStorage.setItem(
          localStorageKey,
          JSON.stringify({
            nodes: newNodes,
            edges: newEdges,
            data,
            collapsedIds: [...collapsedIds],
            collapseSettled: !collapseDefaultPending,
            collapseDefault: DEFAULT_VISIBLE_LEVELS,
          }),
        );
      } catch (e) {
        console.error('Failed to persist map data:', e);
      }
    } else {
      // Re-access data from persistence if prop is missing on refresh
      try {
        const cached = localStorage.getItem(localStorageKey);
        if (cached) {
          const { nodes: oldNodes, edges: oldEdges } = JSON.parse(cached);
          if (oldNodes?.length > 0) {
            setNodes(oldNodes);
            setEdges(oldEdges);
          }
        }
      } catch (e) {
        console.error('Failed to recover map data:', e);
      }
    }
  }, [data, layout, collapsedIds, collapseDefaultPending, rootTitle, setNodes, setEdges, localStorageKey]);

  const handleLayoutChange = (newLayout: MindMapLayout) => {
    setLayout(newLayout);
    setIsLayoutMenuOpen(false);
  };

  const resetLayout = useCallback(() => {
    setSelectedNodeId(null);
    if (is3D) {
      mindMap3DRef.current?.recenter();
      return;
    }
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      const { nodes: newNodes, edges: newEdges } = buildMindMapGraph(data, layout, collapsedIds, rootTitle);
      setNodes(newNodes);
      setEdges(newEdges);
      setTimeout(() => fitView({ padding: 0.05, duration: 800 }), 100);
    }
  }, [data, layout, collapsedIds, rootTitle, setNodes, setEdges, fitView, is3D]);

  const saveToSlot = (idx: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[idx] = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges))
      };
      return next;
    });
  };

  const loadFromSlot = (idx: number) => {
    const slot = slots[idx];
    if (slot) {
      setNodes(slot.nodes);
      setEdges(slot.edges);
      setTimeout(() => fitView({ padding: 0.05, duration: 800 }), 100);
    }
  };

  const deleteSlot = (idx: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const applyFitView = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fitView({ padding: 0.05, duration: 800 });
      }, 100);
    };

    if (nodesInitialized && nodes.length > 0) {
      // Initial fit with slightly larger delay to ensure DOM is ready
      setTimeout(() => {
        fitView({ padding: 0.05, duration: 800 });
      }, 150);

      // Listen to window resizes and any changes to layout wrappers
      window.addEventListener('resize', applyFitView);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', applyFitView);
    };
  }, [nodesInitialized, nodes.length, layout, fitView]);

  useEffect(() => {
    if (!pendingFocusId || is3D) return;
    const ids = [pendingFocusId, ...edges.filter((e) => e.source === pendingFocusId).map((e) => e.target)];
    if (ids.length < 2) return;
    const timer = setTimeout(() => {
      fitView({ nodes: ids.map((id) => ({ id })), padding: 0.3, duration: 800 });
      setPendingFocusId(null);
    }, 150);
    return () => clearTimeout(timer);
  }, [edges, pendingFocusId, is3D, fitView]);


  // "Highlight points to review": everything Jev didn't flag fades back. Offered only once
  // something on this map has been checked.
  const [highlightReview, setHighlightReview] = useState(false);
  const hasChecks = useMemo(() => treeHasChecks(data), [data]);

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(node => {
      // On the canvas the button only sits on nodes that are leaves or that the AI flagged as
      // having more — any other node can still be expanded from its detail panel.
      const state = expandState({ id: node.id, isRoot: node.data.isRoot, depth: node.data.depth ?? 0 });
      const expand = state && (node.data.childCount === 0 || node.data.hasMore)
        ? { ...state, label: t('mindMapExpand.button') }
        : null;
      return {
        ...node,
        data: {
          ...node.data,
          id: node.id,
          onToggleCollapse: handleToggleCollapse,
          onExpand: handleExpandNode,
          expand,
          isSelected: node.id === selectedNodeId,
          reviewLabel: node.data.reviewVerdict === 'CONTRADICTED'
            ? t(node.data.reviewByCase ? 'mindMapCheck.contradictedByCase' : 'mindMapCheck.contradicted')
            : node.data.reviewVerdict === 'UNSUPPORTED'
              ? t(node.data.reviewByCase ? 'mindMapCheck.notSupportedByCase' : 'mindMapCheck.notFound')
              : node.data.reviewVerdict === 'SOURCE_REMOVED'
                ? t('mindMapCheck.sourceRemoved')
                : undefined,
          dimmed: highlightReview && hasChecks && !node.data.isRoot && !node.data.reviewVerdict,
        }
      };
    });
  }, [nodes, handleToggleCollapse, handleExpandNode, expandState, selectedNodeId, highlightReview, hasChecks, t]);

  const selectedTreeNode = useMemo(() => locateTreeNode(data, selectedNodeId), [data, selectedNodeId]);

  // Saved edits come back as a new `data`; move the panel/canvas to the node the edit is about.
  const handleEditSaved = useCallback((edit: MindMapEditRequest) => {
    if (edit.op === 'delete') {
      handleCloseDetails();
      return;
    }
    if (edit.op === 'rename') {
      setSelected3DNodeData((prev: any) => (prev ? { ...prev, label: edit.label, description: edit.description ?? prev.description } : prev));
      return;
    }
    // add: open the parent (it may be collapsed) and bring the new point into view.
    setCollapsedIds((prev) => {
      if (!prev.has(edit.nodeId)) return prev;
      const next = new Set(prev);
      next.delete(edit.nodeId);
      return next;
    });
    setPendingFocusId(edit.nodeId);
  }, [handleCloseDetails]);
  const selectedExpandState = selectedTreeNode
    ? expandState({
        id: selectedTreeNode.item.id,
        isRoot: selectedTreeNode.depth === 0,
        depth: typeof selectedTreeNode.item.depth === 'number' ? selectedTreeNode.item.depth : selectedTreeNode.depth,
      })
    : null;

  // In 3D mode, use the data stored from the 3D click; in 2D use React Flow
  const selectedNodeData = useMemo(() => {
    if (selected3DNodeData) return selected3DNodeData;
    return getNodes().find(n => n.id === selectedNodeId)?.data;
  }, [selectedNodeId, getNodes, selected3DNodeData]);

  // Check if selected node has audio media
  const hasAudioMedia = selectedNodeData?.media && selectedNodeData.media.some((m: any) => m.type === 'audio');

  // Auto-open audio player when node with audio is selected
  useEffect(() => {
    if (selectedNodeData?.media && selectedNodeData.media.length > 0) {
      const audioItem = selectedNodeData.media.find((m: any) => m.type === 'audio');
      if (audioItem) {
        setPlayingAudio(audioItem);
      }
    }
  }, [selectedNodeData]);

  // Ensure clicking away closes audio modal as well
  useEffect(() => {
    if (!selectedNodeId) {
      setPlayingAudio(null);
    }
  }, [selectedNodeId]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[320px] max-h-[1200px] rounded-2xl border-2 overflow-hidden relative transition-colors duration-500 scrollbar-hide flex flex-col ${MIND_MAP_CHROME.canvas} ${isFullScreen ? 'h-screen max-h-none border-none rounded-none' : ''}`}
    >
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none !important; }
        .scrollbar-hide { -ms-overflow-style: none !important; scrollbar-width: none !important; overflow: hidden !important; }
        .react-flow__viewport { transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1); }
        .react-flow__node { transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease !important; }
      `}</style>

      <div className="flex-1 relative overflow-hidden">
        {/* 3D Model Layer */}
        {is3D && data && (
          <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden z-10">
            <MindMap3D
              ref={mindMap3DRef}
              root={data}
              rootTitle={rootTitle}
              isDark={isDark}
              onNodeClick={(node: any) => {
                setSelectedNodeId(node.id);
                // Store full enriched data so detail panel works in 3D mode
                setSelected3DNodeData({
                  label: node.label,
                  description: node.description,
                  media: node.media,
                  color: node.color
                });
              }}
              onBackgroundClick={handleCloseDetails}
            />
          </div>
        )}

        <div className={`absolute inset-0 transition-opacity duration-700 ${is3D ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_: React.MouseEvent, node: Node) => {
              setSelectedNodeId(node.id);
              setSelected3DNodeData({
                label: node.data.label,
                description: node.data.description,
                media: node.data.media,
                color: node.data.color
              });
              fitView({ nodes: [node], duration: 1000, padding: 0.6 });
            }}
            onPaneClick={handleCloseDetails}
            nodeTypes={nodeTypes}
            nodesDraggable={true}
            // Dragging a new edge between nodes only ever changed this browser's copy of the map
            // and vanished on reload — structure changes go through the detail panel's editor.
            nodesConnectable={false}
            onlyRenderVisibleElements={nodes.length > MIND_MAP_PERF_THRESHOLD}
            elementsSelectable={true}
            panOnDrag={true}
            panOnScroll={false}
            panOnScrollSpeed={0.8}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={false}
            defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
            fitView
            fitViewOptions={{ padding: 0.05, duration: 1000 }}
            minZoom={0.05}
            maxZoom={1.5}
            style={{ background: 'transparent', transition: 'all 0.24s ease' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color={mindMapGridColor(isDark)} gap={24} />
          </ReactFlow>
        </div>
      </div>

      {/* Perspective Toggle - Top Left (2D/3D Switch) */}
      <div className="absolute top-4 left-4 z-(--z-canvas-overlay) flex items-center gap-2">
        <button
          onClick={() => {
            setIs3D(!is3D);
            setIsLayoutMenuOpen(false);
          }}
          className={is3D ? MIND_MAP_CHROME.toggleOn : MIND_MAP_CHROME.toggleOff}
        >
          {is3D ? <Monitor size={14} /> : <Box size={14} />}
          <span className="text-[8px] md:text-[9px] uppercase tracking-widest leading-none">{is3D ? '2D' : '3D'}</span>
        </button>

        {/* MINIMIZED Structure Selector — 2D only: its layouts, levels and highlight all act on
         * the 2D canvas, and the 3D graph lays itself out. */}
        {!is3D && (
        <div className="relative">
          <button
            onClick={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)}
            className={MIND_MAP_CHROME.accentBtn}
          >
            <Layout size={12} />
            <span className="text-[9px] uppercase tracking-wider leading-none">Structure</span>
          </button>

          {isLayoutMenuOpen && (
            <div className={MIND_MAP_CHROME.menu}>
              <div className={MIND_MAP_CHROME.menuHeader}>
                <span className={MIND_MAP_CHROME.menuHeaderLabel}>Layout Models</span>
              </div>
              <div className="p-1 grid grid-cols-1">
                {[
                  { id: 'horizontal', name: 'Strategic Flow', icon: '→' },
                  { id: 'vertical', name: 'Legal Hierarchy', icon: '↓' },
                  { id: 'dual', name: 'Dual Perspective', icon: '↔' },
                  { id: 'radial', name: 'Radial Layout', icon: '○' },
                  { id: 'compact', name: 'Dense Analysis', icon: '▩' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleLayoutChange(item.id as any)}
                    className={layout === item.id ? MIND_MAP_CHROME.menuItemActive : MIND_MAP_CHROME.menuItem}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-4 text-center opacity-50">{item.icon}</span>
                      {item.name}
                    </div>
                    {layout === item.id && <Check size={10} strokeWidth={4} />}
                  </button>
                ))}
              </div>
              {mapDepth > 1 && (
                <>
                  <div className={MIND_MAP_CHROME.menuHeader}>
                    <span className={MIND_MAP_CHROME.menuHeaderLabel}>{t('mindMapStructure.showLevels')}</span>
                  </div>
                  <div className="p-1 grid grid-cols-1">
                    {Array.from({ length: Math.min(mapDepth - 1, MIND_MAP_LIMITS.maxDepth - 1) }, (_, i) => i + 1).map((level) => (
                      <button key={level} onClick={() => showLevels(level)} className={MIND_MAP_CHROME.menuItem}>
                        {t('mindMapStructure.upToLevel', { level })}
                      </button>
                    ))}
                    <button onClick={() => showLevels(null)} className={MIND_MAP_CHROME.menuItem}>
                      {t('mindMapStructure.expandAll')}
                    </button>
                  </div>
                </>
              )}
              {hasChecks && (
                <div className="p-1 border-t border-border">
                  <button
                    onClick={() => setHighlightReview((v) => !v)}
                    className={highlightReview ? MIND_MAP_CHROME.menuItemActive : MIND_MAP_CHROME.menuItem}
                    aria-pressed={highlightReview}
                  >
                    {t('mindMapCheck.highlight')}
                    {highlightReview && <Check size={10} strokeWidth={4} />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      <div className="absolute top-4 right-4 z-(--z-canvas-overlay) pointer-events-auto flex items-center gap-2">
        {/* The map's only Regenerate control (Studio's panel header no longer has one), and the
         * only chrome still visible once "Full" takes the map into the browser's native
         * fullscreen. Reachable regardless of staleness; the stale badge below is just a louder, more urgent
         * version of the same action for when the case has moved on since this map generated. */}
        {onRegenerate && !isStale && (
          <button
            type="button"
            onClick={requestRegenerate}
            disabled={regenerating}
            title={regenerating ? regeneratingLabel : 'Regenerate mind map'}
            aria-label={regenerating ? regeneratingLabel : 'Regenerate mind map'}
            className={MIND_MAP_CHROME.regenerateIconBtn}
          >
            {regenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        )}
        {isStale && (
          <button
            type="button"
            onClick={requestRegenerate}
            disabled={regenerating}
            title={regenerating ? regeneratingLabel : `${staleDetail ?? 'Case has new activity since this map was generated'} · Regenerate`}
            aria-label={regenerating ? regeneratingLabel : `Stale mind map: ${staleDetail ?? 'the case has new activity since it was generated'}. Regenerate`}
            className={MIND_MAP_CHROME.staleIconBtn}
          >
            {regenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        )}
        <button
          onClick={toggleFullScreen}
          className={MIND_MAP_CHROME.fullBtn}
        >
          <Maximize size={12} />
          <span className="hidden sm:inline text-[9px] uppercase tracking-wider">{isFullScreen ? 'Exit' : 'Full'}</span>
        </button>
      </div>

      {confirmRegenerate && expansion && (
        <div
          role="alertdialog"
          aria-labelledby="mind-map-regenerate-warning"
          className="absolute top-16 right-4 z-(--z-canvas-overlay) w-[min(20rem,calc(100%-2rem))] rounded-xl border border-amber-500/40 bg-card/95 p-3 shadow-lg backdrop-blur-md"
        >
          <p id="mind-map-regenerate-warning" className="text-[13px] leading-snug text-foreground">
            {t('mindMapExpand.regenerateWarning', { count: expansion.expandedCount })}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmRegenerate(false)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t('mindMapExpand.cancel')}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmRegenerate(false); onRegenerate?.(); }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700"
            >
              {t('mindMapExpand.regenerateConfirm')}
            </button>
          </div>
        </div>
      )}

      {/* Ultra-Compact Vertical Hub - Snug Corner */}
      <div className={MIND_MAP_CHROME.hub}>

        {/* Navigation Group - Minimalist */}
        <div className={MIND_MAP_CHROME.hubGroup}>
          <button
            onClick={() => is3D ? mindMap3DRef.current?.zoomIn() : zoomIn()}
            className={MIND_MAP_CHROME.hubBtn}
            title="Zoom In"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => is3D ? mindMap3DRef.current?.zoomOut() : zoomOut()}
            className={MIND_MAP_CHROME.hubBtn}
            title="Zoom Out"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => is3D ? mindMap3DRef.current?.recenter() : fitView({ padding: 0.05, duration: 800 })}
            className={MIND_MAP_CHROME.hubBtnSm}
            title="Recenter"
          >
            <Target size={14} />
          </button>
        </div>

        {/* Memory Trigger - Ultra Tight */}
        <div className="relative group/mem">
          <button
            onClick={() => setIsMemoryOpen(!isMemoryOpen)}
            className={isMemoryOpen ? MIND_MAP_CHROME.hubBtnActive : MIND_MAP_CHROME.hubBtnIdle}
            title="Snapshots"
          >
            <Save size={14} />
          </button>

          {/* Pop-out Dropdown - Snug position */}
          {isMemoryOpen && (
            <div className={MIND_MAP_CHROME.memory}>
              <div className={MIND_MAP_CHROME.memoryTitle}>Saved Structures</div>
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className={MIND_MAP_CHROME.memoryRow}>
                    <div className={MIND_MAP_CHROME.memoryIndex}>
                      {idx + 1}
                    </div>

                    <div className="flex items-center gap-1.5 ml-4">
                      <button
                        onClick={() => { saveToSlot(idx); setIsMemoryOpen(false); }}
                        className={MIND_MAP_CHROME.memorySave}
                      >
                        SAVE
                      </button>
                      {slots[idx] && (
                        <>
                          <div className="w-[1px] h-3 bg-border" />
                          <button
                            onClick={() => { loadFromSlot(idx); setIsMemoryOpen(false); }}
                            className={MIND_MAP_CHROME.memoryLoad}
                          >
                            LOAD
                          </button>
                          <button
                            onClick={() => deleteSlot(idx)}
                            className="p-1 px-1.5 text-muted-foreground hover:text-red-400 rounded-md transition-colors"
                          >
                            <Trash2 size={10} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={MIND_MAP_CHROME.hubDivider} />

        {/* Reset - Flush Bottom */}
        <button
          onClick={resetLayout}
          className="p-1.5 text-muted-foreground hover:text-red-500 transition-all group active:scale-95"
          title="Reset Map"
        >
          <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
        </button>
      </div>

      {containerRef.current && ReactDOM.createPortal(
        <AnimatePresence mode="wait">
          {selectedNodeId && selectedNodeData && !hasAudioMedia && (
            <motion.div
              key={selectedNodeId}
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={MIND_MAP_CHROME.detail}
            >
              {/* Elegant Header Accent */}
              <div
                className="h-1 w-full opacity-90"
                style={{
                  background: selectedNodeData.color?.startsWith('#')
                    ? selectedNodeData.color
                    : (selectedNodeData.color?.replace('bg-', '') || '#e9c176')
                }}
              />

              <div
                className="p-5 md:p-7"
                style={{
                  borderTop: `2px solid ${selectedNodeData.color?.startsWith('#') ? selectedNodeData.color : (selectedNodeData.color?.replace('bg-', '') || '#e9c176')}`,
                  boxShadow: `0 18px 45px ${selectedNodeData.color?.startsWith('#') ? selectedNodeData.color : (selectedNodeData.color?.replace('bg-', '') || '#e9c176')}40`,
                }}
              >
                <div className="flex items-start justify-between mb-4 gap-3 min-w-0">
                  <h3 className={MIND_MAP_CHROME.detailTitle}>
                    {selectedNodeData.label}
                  </h3>
                  <button
                    onClick={handleCloseDetails}
                    className={MIND_MAP_CHROME.detailClose}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-4">
                  {(() => {
                    const desc = selectedNodeData.description || "";

                    if (!desc.trim()) {
                      return (
                        <p className={`${MIND_MAP_CHROME.detailBody} text-muted-foreground italic`}>
                          No additional details for this node.
                        </p>
                      );
                    }

                    const isList = desc.includes('\n-') || desc.includes('\n*') || desc.startsWith('-') || desc.startsWith('*');
                    const isShort = desc.length < 50 && !desc.includes('.');

                    if (isList || isShort) {
                      const lines = desc.split('\n').map((l: string) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
                      return (
                        <div className="flex flex-col gap-3">
                          <span className={MIND_MAP_CHROME.detailLabel}>Key Evidence</span>
                          <ul className="space-y-2">
                            {lines.map((line: string, i: number) => (
                              <li key={i} className="text-[14px] text-muted-foreground flex items-start gap-2 leading-tight">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-gold/40 mt-1 shrink-0" />
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => <span className="inline-block">{children}</span>,
                                    strong: ({ children }) => <strong className={MIND_MAP_CHROME.detailStrong}>{children}</strong>
                                  }}
                                >
                                  {line}
                                </ReactMarkdown>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }

                    return (
                      <div className={MIND_MAP_CHROME.detailBody}>
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className={MIND_MAP_CHROME.detailStrong}>{children}</strong>
                          }}
                        >
                          {desc}
                        </ReactMarkdown>
                      </div>
                    );
                  })()}

                  {selectedTreeNode && (selectedTreeNode.item.sources?.length || selectedTreeNode.item.check || selectedTreeNode.item.sourceRemoved) && (
                    <NodeEvidence item={selectedTreeNode.item} documentNames={documentNames} />
                  )}

                  {selectedExpandState && (
                    <div className="border-t border-border pt-4">
                      <button
                        type="button"
                        onClick={() => void handleExpandNode(selectedTreeNode!.item.id)}
                        disabled={selectedExpandState.disabled}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-brand-navy-950 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {selectedExpandState.busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {selectedExpandState.busy ? t('mindMapExpand.expanding') : t('mindMapExpand.generateMore')}
                      </button>
                      {selectedExpandState.hint && !selectedExpandState.busy && (
                        <p className="mt-2 text-center text-[12px] text-muted-foreground">{selectedExpandState.hint}</p>
                      )}
                    </div>
                  )}

                  {expansion && selectedTreeNode && selectedTreeNode.depth > 0 && (
                    <div className="border-t border-border pt-3">
                      <NodeEditor
                        key={selectedTreeNode.item.id}
                        node={{
                          id: selectedTreeNode.item.id,
                          label: selectedTreeNode.item.label ?? '',
                          description: selectedTreeNode.item.description,
                          depth: typeof selectedTreeNode.item.depth === 'number' ? selectedTreeNode.item.depth : selectedTreeNode.depth,
                          childCount: (selectedTreeNode.item.children ?? []).length,
                          descendantCount: countDescendants(selectedTreeNode.item),
                        }}
                        onEdit={expansion.edit}
                        onSaved={handleEditSaved}
                        disabledReason={expansion.disabledReason}
                        atNodeCap={totalNodes >= MIND_MAP_LIMITS.maxNodes}
                      />
                    </div>
                  )}

                  {/* Attached evidence (shared between 2D/3D). MindMapItem has a `media` field,
                      but this app's AI pipeline doesn't populate it today — rendered here so
                      nodes light this up automatically once it does. */}
                  {selectedNodeData.media && selectedNodeData.media.length > 0 && (
                    <div className="mt-8 border-t border-border pt-6 space-y-4">
                      <span className={MIND_MAP_CHROME.detailLabel}>Attached Files ({selectedNodeData.media.length})</span>
                      <div className="flex flex-col gap-3">
                        {selectedNodeData.media.map((item: any, idx: number) => {
                          if (item.type === 'image') return (
                            <div key={idx} className="relative group/media overflow-hidden rounded-xl border border-white/10 shadow-lg">
                              {(() => {
                                const url = item.url;
                                const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');
                                const isMissingUrl = !url || url === '#' || isBlobUrl;
                                if (isMissingUrl) {
                                  return (
                                    <div className="w-full h-full min-h-[140px] bg-muted border border-dashed border-border flex flex-col items-center justify-center text-center p-4">
                                      <span className="text-4xl mb-2 grayscale opacity-50">🖼️</span>
                                      <span className="text-muted-foreground text-xs font-semibold">{item.name || 'Image'} Preview Not Available</span>
                                    </div>
                                  );
                                }
                                return (
                                  <img
                                    src={url}
                                    alt={item.name}
                                    className="w-full h-auto max-h-[160px] object-cover transition-transform group-hover/media:scale-[1.02]"
                                  />
                                );
                              })()}
                              {(() => {
                                const url = item.url;
                                const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');
                                const isMissingUrl = !url || url === '#' || isBlobUrl;
                                if (isMissingUrl) return null;
                                return (
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <a href={url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white text-black dark:bg-card dark:text-foreground text-[11px] font-black rounded-lg uppercase tracking-wider shadow-xl hover:scale-105 transition-transform">
                                      Expand File
                                    </a>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                          if (item.type === 'audio') return null;
                          if (item.type === 'file') {
                            const isBlobUrl = typeof item.url === 'string' && item.url.startsWith('blob:');
                            const isMissingUrl = !item.url || item.url === '#' || isBlobUrl;

                            // Deliberately not routed through a third-party Office viewer embed
                            // (unlike law-ph) — matches this app's file-preview-modal.tsx policy
                            // of never sending a document's URL to a third party.
                            return (
                              <div key={idx} className="flex items-center gap-3 bg-muted p-2.5 rounded-xl border border-border shadow-lg">
                                <div className="bg-brand-gold text-brand-navy-950 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-lg shrink-0">📄</div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-sm font-medium truncate text-foreground">{item.name}</span>
                                  {isMissingUrl ? (
                                    <span className="text-[10px] text-muted-foreground">Preview not available</span>
                                  ) : (
                                    <a href={item.url} target="_blank" rel="noreferrer" className="text-[10px] text-brand-gold hover:text-foreground uppercase tracking-[0.15em] font-bold transition-all w-fit">
                                      Open Original Source ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {/* Audio Player Bottom Modal */}
          {playingAudio && (
            <motion.div
              key="audio-player"
              initial={{ opacity: 0, scale: 0.98, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98, x: 20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={MIND_MAP_CHROME.audioBar}
              onClick={(e: React.MouseEvent) => {
                // Close modal when clicking on the background (not on the content)
                if (e.target === e.currentTarget) {
                  handleCloseDetails();
                }
              }}
            >
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="text-3xl">🎵</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-foreground font-bold truncate">{playingAudio.name}</h4>
                      <p className="text-muted-foreground text-sm">Now Playing</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseDetails}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                {(() => {
                  const url = playingAudio.url;
                  const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');
                  const isMissingUrl = !url || url === '#' || isBlobUrl;

                  if (isMissingUrl) {
                    return (
                      <div className="w-full py-8 rounded-lg bg-muted border border-dashed border-border flex flex-col items-center justify-center text-center">
                        <span className="text-2xl mb-2 grayscale opacity-50">🔇</span>
                        <span className="text-muted-foreground text-sm font-semibold">Preview Not Available</span>
                        <span className="text-muted-foreground/80 text-xs mt-1">This audio file was uploaded offline or its URL has expired.</span>
                      </div>
                    );
                  }

                  return (
                    <audio
                      autoPlay
                      controls
                      className="w-full accent-[#00E5FF]"
                      style={{
                        filter: 'brightness(1.1)',
                      }}
                    >
                      <source src={url} />
                    </audio>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        containerRef.current
      )}
    </div>
  );
}

export function MindMap(props: MindMapProps) {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  );
}
