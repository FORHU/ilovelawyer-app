import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ReactDOM from 'react-dom';
import { useTheme } from 'next-themes';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Connection,
  Edge,
  Node,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Maximize, Check, Save, RotateCcw, Trash2, Plus, Minus, Target, X, Box, Monitor } from 'lucide-react';
import { MindMapProps } from './types';
import { MIND_MAP_HEX_COLORS, MIND_MAP_THEME, MIND_MAP_CHROME, mindMapGridColor } from './constants';
import ReactMarkdown from 'react-markdown';
import { CustomNode } from './custom-node';
import type { MindMap3DHandle, MindMap3DProps } from './mind-map-3d';

const MindMap3D = dynamic(() => import('./mind-map-3d').then(m => m.MindMap3D), {
  ssr: false,
  loading: () => (
    <div className={MIND_MAP_CHROME.loading3d}>
      Loading mind map...
    </div>
  ),
}) as React.ForwardRefExoticComponent<MindMap3DProps & React.RefAttributes<MindMap3DHandle>>;

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
        isRoot: true,
        color: '#722f37',
        className: MIND_MAP_THEME.rootClass,
      },
      position: { x: 0, y: 0 },
    },
  ];
};

function MindMapInner({ rootTitle = "Case Analysis", data, consultationId }: MindMapProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  const [layout, setLayout] = useState<'horizontal' | 'vertical' | 'compact' | 'radial' | 'dual'>('horizontal');
  const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  // Undo-stack storage only — law-ph itself has no UI trigger wired to pop it, so this
  // component doesn't expose one either; kept so saveToHistory (used by every edit action)
  // has somewhere to write.
  const [, setHistory] = useState<{ nodes: Node[], edges: Edge[] }[]>([]);
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

  const getChildren = (item: any) => {
    return item.children || item.items || item.nodes || item.subnodes || item.branches || item.subitems || [];
  };

  const treeToGraph = useCallback((root: any, currentLayout: 'horizontal' | 'vertical' | 'compact' | 'radial' | 'dual') => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const subtreeSizes = new Map<any, number>();
    const calcSize = (item: any): number => {
      const children = getChildren(item);
      if (children.length === 0) {
        return currentLayout === 'vertical' ? 260 : 130;
      }
      let total = 0;
      children.forEach((child: any) => {
        total += calcSize(child);
      });
      const sizeWithPadding = Math.max(total + (children.length - 1) * 28, currentLayout === 'vertical' ? 260 : 130);
      subtreeSizes.set(item, sizeWithPadding);
      return sizeWithPadding;
    };

    calcSize(root);

    const traverse = (item: any, parentId: string | null = null, x = 0, y = 0, angleRange: [number, number] = [0, 360], depth = 0, side: 'left' | 'right' | 'top' | 'bottom' = 'right') => {
      const id = item.id || `node-${Math.random().toString(36).substr(2, 9)}`;
      const isRoot = id === 'root' || !parentId;

      const hexColor = isRoot ? '#722f37' : MIND_MAP_HEX_COLORS[Math.max(0, depth - 1) % MIND_MAP_HEX_COLORS.length];
      const className = isRoot ? MIND_MAP_THEME.rootClass : MIND_MAP_THEME.nodeClass(Math.max(0, depth - 1));

      let label = item.label || item.text || 'Untitled';
      const description = item.description || item.details || item.summary || '';

      if (isRoot && (label === 'Case Analysis' || label === 'Legal Strategy Map')) {
        label = rootTitle;
      }

      nodes.push({
        id,
        type: 'custom',
        data: {
          label,
          description,
          media: item.media, // Pass media data forward for 2D/3D
          isRoot,
          color: hexColor,
          className,
          layout: currentLayout,
          side // Pass the calculated side to the node
        },
        position: { x, y },
      });

      if (parentId) {
        // Root node in Dual/Radial has multiple source handles (left, right, top, bottom)
        const isFromRoot = parentId === 'root' && (currentLayout === 'dual' || currentLayout === 'radial');
        const sourceHandleId = isFromRoot ? side : undefined;

        const edgeDepth = depth; // child depth relative to root
        const edgeColor = edgeDepth > 0 ? MIND_MAP_HEX_COLORS[(edgeDepth - 1) % MIND_MAP_HEX_COLORS.length] : MIND_MAP_THEME.edgeColor;

        edges.push({
          id: `e${parentId}-${id}`,
          source: parentId,
          target: id,
          sourceHandle: sourceHandleId,
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor }
        });
      }

      const children = getChildren(item);
      if (children.length > 0) {
        if (currentLayout === 'radial') {
          // Calculate a dynamic global radius from the center (0,0) instead of the parent
          // This creates concentric circles and prevents messy overlapping
          let depthRadius = 600;
          if (depth === 0) depthRadius = 600;
          else if (depth === 1) depthRadius = 1200;
          else depthRadius = 1200 + (depth - 1) * 600;

          const [startAngle, endAngle] = angleRange;
          const totalAngle = endAngle - startAngle;
          const anglePerChild = totalAngle / children.length;

          children.forEach((child: any, index: number) => {
            const currentAngle = startAngle + (anglePerChild * index) + (anglePerChild / 2);
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const rad = (currentAngle * Math.PI) / 180;
            // Position relative to Root (0,0) not the parent's x,y
            const cx = depthRadius * Math.cos(rad);
            const cy = depthRadius * Math.sin(rad);

            const childStart = startAngle + (anglePerChild * index);
            const childEnd = childStart + anglePerChild;

            // Map angle to the best handle on the parent/root
            let childSide: 'left' | 'right' | 'top' | 'bottom' = 'right';
            if (normalizedAngle >= 45 && normalizedAngle < 135) childSide = 'bottom';
            else if (normalizedAngle >= 135 && normalizedAngle < 225) childSide = 'left';
            else if (normalizedAngle >= 225 && normalizedAngle < 315) childSide = 'top';

            traverse(child, id, cx, cy, [childStart, childEnd], depth + 1, childSide);
          });
        } else if (currentLayout === 'dual' && isRoot) {
          const midway = Math.ceil(children.length / 2);
          const leftChildren = children.slice(0, midway);
          const rightChildren = children.slice(midway);

          const leftSize = leftChildren.reduce((acc: number, c: any) => acc + (subtreeSizes.get(c) || 130), 0) + (leftChildren.length - 1) * 28;
          const rightSize = rightChildren.reduce((acc: number, acc_val: any) => acc + (subtreeSizes.get(acc_val) || 130), 0) + (rightChildren.length - 1) * 28;

          let leftOffset = -(leftSize / 2);
          leftChildren.forEach((child: any) => {
            const childSize = subtreeSizes.get(child) || 130;
            traverse(child, id, x - 550, y + (leftOffset + childSize / 2), [0, 0], 1, 'left');
            leftOffset += childSize + 28;
          });

          let rightOffset = -(rightSize / 2);
          rightChildren.forEach((child: any) => {
            const childSize = subtreeSizes.get(child) || 130;
            traverse(child, id, x + 550, y + (rightOffset + childSize / 2), [0, 0], 1, 'right');
            rightOffset += childSize + 28;
          });
        } else {
          const itemSize = subtreeSizes.get(item) || (currentLayout === 'vertical' ? 260 : 130);
          let offset = -(itemSize / 2);

          children.forEach((child: any) => {
            const childSize = subtreeSizes.get(child) || (currentLayout === 'vertical' ? 260 : 130);
            const posOffset = offset + (childSize / 2);

            if (currentLayout === 'vertical') {
              traverse(child, id, x + posOffset, y + 400, [0, 0], depth + 1);
            } else if (currentLayout === 'dual') {
              traverse(child, id, x + (side === 'left' ? -550 : 550), y + posOffset, [0, 0], depth + 1, side);
            } else if (currentLayout === 'compact') {
              traverse(child, id, x + 500, y + posOffset, [0, 0], depth + 1);
            } else {
              traverse(child, id, x + 550, y + posOffset, [0, 0], depth + 1);
            }

            offset += childSize + 28;
          });
        }
      }
    };

    traverse(root, null, 0, 0);
    return { nodes, edges };
  }, [rootTitle]);

  useEffect(() => {
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      const { nodes: newNodes, edges: newEdges } = treeToGraph(data, layout);
      setNodes(newNodes);
      setEdges(newEdges);

      // Persist the state to survive refreshes
      try {
        localStorage.setItem(localStorageKey, JSON.stringify({ nodes: newNodes, edges: newEdges, data }));
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
  }, [data, layout, treeToGraph, setNodes, setEdges, localStorageKey]);

  const handleLayoutChange = (newLayout: 'horizontal' | 'vertical' | 'compact' | 'radial' | 'dual') => {
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
      const { nodes: newNodes, edges: newEdges } = treeToGraph(data, layout);
      setNodes(newNodes);
      setEdges(newEdges);
      setTimeout(() => fitView({ padding: 0.05, duration: 800 }), 100);
    }
  }, [data, layout, treeToGraph, setNodes, setEdges, fitView, is3D]);

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

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-15), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }]);
  }, [nodes, edges]);

  const onConnect = useCallback((params: Connection | Edge) => {
    saveToHistory();
    setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: MIND_MAP_THEME.edgeColor, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: MIND_MAP_THEME.edgeColor }
    }, eds));
  }, [setEdges, saveToHistory]);

  const handleEditNode = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const newLabel = prompt('Enter new text:', node.data.label);
    if (newLabel !== null) {
      saveToHistory();
      setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n));
    }
  }, [nodes, setNodes, saveToHistory]);

  const handleDeleteNode = useCallback((id: string) => {
    if (id === 'root') return;
    saveToHistory();
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  }, [setNodes, setEdges, saveToHistory]);

  const handleAddNode = useCallback((parentId: string) => {
    saveToHistory();
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return;
    const id = Date.now().toString();
    const childIndex = edges.filter(e => e.source === parentId).length;

    const hexColor = MIND_MAP_HEX_COLORS[childIndex % MIND_MAP_HEX_COLORS.length];
    const className = MIND_MAP_THEME.nodeClass(childIndex);
    const newNode: Node = {
      id,
      type: 'custom',
      data: { id, label: 'New Node', color: hexColor, className, onEdit: handleEditNode, onAdd: handleAddNode, onDelete: handleDeleteNode },
      position: { x: parentNode.position.x + 500, y: parentNode.position.y + (childIndex - 1) * 150 },
    };
    const newEdge: Edge = {
      id: `e${parentId}-${id}`, source: parentId, target: id, animated: true,
      style: { stroke: MIND_MAP_THEME.edgeColor, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: MIND_MAP_THEME.edgeColor }
    };
    setNodes((nds) => nds.concat(newNode));
    setEdges((eds) => eds.concat(newEdge));
    // `handleAddNode` itself is intentionally omitted from the deps below: this is its own
    // initial-mount definition, referenced only inside a closure that fires later (in a click
    // handler), by which point the real value is already assigned.
  }, [nodes, edges, setNodes, setEdges, handleEditNode, handleDeleteNode, saveToHistory]);

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: { ...node.data, id: node.id, onEdit: handleEditNode, onAdd: handleAddNode, onDelete: handleDeleteNode, isSelected: node.id === selectedNodeId }
    }));
  }, [nodes, handleEditNode, handleAddNode, handleDeleteNode, selectedNodeId]);

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
            onConnect={onConnect}
            onNodeClick={(_, node) => {
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
            nodesConnectable={true}
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
      <div className="absolute top-4 left-4 z-[100000] flex items-center gap-2">
        <button
          onClick={() => setIs3D(!is3D)}
          className={is3D ? MIND_MAP_CHROME.toggleOn : MIND_MAP_CHROME.toggleOff}
        >
          {is3D ? <Monitor size={14} /> : <Box size={14} />}
          <span className="text-[8px] md:text-[9px] uppercase tracking-widest leading-none">{is3D ? '2D' : '3D'}</span>
        </button>

        {/* MINIMIZED Structure Selector */}
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
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-[100000] pointer-events-auto flex items-center gap-2">
        <button
          onClick={toggleFullScreen}
          className={MIND_MAP_CHROME.fullBtn}
        >
          <Maximize size={12} />
          <span className="hidden sm:inline text-[9px] uppercase tracking-wider">{isFullScreen ? 'Exit' : 'Full'}</span>
        </button>
      </div>

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
                    const desc = selectedNodeData.description || "N/A";
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

                  {/* Attached evidence (shared between 2D/3D). Not populated by this app's AI
                      pipeline today — MindMapItem carries no `media` field yet — but rendered
                      here so nodes light this up automatically once it is. */}
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
                                    <a href={url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white text-black text-[11px] font-black rounded-lg uppercase tracking-wider shadow-xl hover:scale-105 transition-transform">
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
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all"
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
