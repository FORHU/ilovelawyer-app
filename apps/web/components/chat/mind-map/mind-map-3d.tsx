'use client';

import React, { useRef, useMemo, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { MindMapItem } from './types';
import { MIND_MAP_HEX_COLORS, mindMapLink3dColor } from './constants';

export interface MindMap3DProps {
  root: MindMapItem | null;
  rootTitle: string;
  isDark?: boolean;
  onNodeClick: (node: any) => void;
  onBackgroundClick?: () => void;
}

export interface MindMap3DHandle {
  recenter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export const MindMap3D = forwardRef<MindMap3DHandle, MindMap3DProps>(({ root, rootTitle, isDark = false, onNodeClick, onBackgroundClick }, ref) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const hasFittedInitial = useRef(false);
  const lastNodeClickAt = useRef<number>(0);

  // Track dimensions for perfect centering
  const [dims, setDims] = React.useState({ width: 800, height: 600 });

  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDims({ width: clientWidth, height: clientHeight });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const applyTightZoom = useCallback((duration = 1000) => {
    if (!fgRef.current) return;
    // Only zoom out to fit the whole structure.
    // Negative padding makes the fit "tighter"/closer while still fitting all nodes,
    // avoiding the "too far away" look without a second camera move.
    fgRef.current.zoomToFit(duration, -30);
  }, []);

  // Public API for the parent component
  useImperativeHandle(ref, () => ({
    recenter: () => {
      applyTightZoom(1000);
    },
    zoomIn: () => {
      if (fgRef.current) {
        const cam = fgRef.current.camera();
        cam.position.z *= 0.8;
      }
    },
    zoomOut: () => {
      if (fgRef.current) {
        const cam = fgRef.current.camera();
        cam.position.z *= 1.2;
      }
    }
  }));

  // Convert the hierarchical tree into a FLAT list of nodes and links for ForceGraph3D
  // Leaf-Weighted Concentric Radial Layout
  const graphData = useMemo(() => {
    if (!root) return { nodes: [], links: [] };

    const nodes: any[] = [];
    const links: any[] = [];

    // Robust field extraction matching index.tsx
    const getChildren = (item: any) => item.children || item.items || item.nodes || item.subnodes || item.branches || item.subitems || [];
    const getLabel = (item: any) => item.label || item.text || item.title || 'Untitled';
    const getDescription = (item: any) => item.description || item.details || item.summary || item.content || '';
    const getMedia = (item: any) => item.media || item.evidence || item.attachments || [];

    // ID Memoization to handle data without consistent IDs
    const idMap = new WeakMap();
    const getId = (item: any) => {
      if (item.id) return item.id;
      if (!idMap.has(item)) idMap.set(item, `node-${Math.random().toString(36).substr(2, 9)}`);
      return idMap.get(item);
    };

    // 1. Calculate Leaf Weights for Perfect Symmetry
    const leafMap = new Map();
    const calculateLeaves = (node: any) => {
      const children = getChildren(node);
      const nid = getId(node);
      if (children.length === 0) {
        leafMap.set(nid, 1);
        return 1;
      }
      let sum = 0;
      children.forEach((c: any) => sum += calculateLeaves(c));
      leafMap.set(nid, sum);
      return sum;
    };
    calculateLeaves(root);

    // 2. Leaf-Weighted Concentric Radial Layout
    const traverse = (item: any, depth = 0, angleStart = 0, angleEnd = 2 * Math.PI) => {
      const isRoot = depth === 0;
      const nodeId = getId(item);
      let label = getLabel(item);

      if (isRoot && (label === 'Case Analysis' || label === 'Legal Strategy Map')) {
        label = rootTitle;
      }

      const midAngle = (angleStart + angleEnd) / 2;
      const radius = depth * 240;

      const x = radius * Math.cos(midAngle);
      const y = radius * Math.sin(midAngle);

      // True 3D Scatter: Create a 'saddle curve' by sweeping the Z-axis up and down
      // based on the branch's rotation, resulting in a stunning spherical constellation.
      const zWave = Math.sin(midAngle * 3) * (radius * 0.85);
      const z = isRoot ? 0 : zWave + (depth % 2 === 0 ? 40 : -40);

      const colors = MIND_MAP_HEX_COLORS;
      const paletteIndex = Math.max(0, depth - 1);

      nodes.push({
        id: nodeId,
        label,
        description: getDescription(item),
        media: getMedia(item),
        isRoot,
        fx: x, fy: y, fz: z,
        color: isRoot ? '#722f37' : colors[paletteIndex % colors.length]
      });

      const children = getChildren(item);
      if (children.length > 0) {
        const totalLeaves = leafMap.get(item.id);
        let currentAngle = angleStart;

        children.forEach((child: any) => {
          const childId = getId(child);
          links.push({ source: nodeId, target: childId });

          const childLeaves = leafMap.get(childId);
          const angleShare = (childLeaves / (totalLeaves || 1)) * (angleEnd - angleStart);

          traverse(child, depth + 1, currentAngle, currentAngle + angleShare);
          currentAngle += angleShare;
        });
      }
    };

    traverse(root, 0, 0, 2 * Math.PI);
    return { nodes, links };
  }, [root, rootTitle]);

  // Adjust camera and simulation forces
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('link').distance(150);
      fgRef.current.d3Force('charge').strength(-1500);
      hasFittedInitial.current = false;
    }
  }, [graphData]);

  // Custom Node Renderer
  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();

    // Helper to convert hex color to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16)
      } : { r: 255, g: 255, b: 255 };
    };

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      const text = node.label || '';
      const fontSize = 48;
      context.font = `bold ${fontSize}px Inter, -apple-system, sans-serif`;
      const textWidth = context.measureText(text).width;

      canvas.width = textWidth + 100;
      canvas.height = fontSize + 50;

      // Get RGB values from node color
      const rgb = hexToRgb(node.color);

      // Semi-transparent colored background (20% opacity like Tailwind's /20)
      context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.28 : 0.92})`;
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Colored border matching node color (50% opacity) - only for root nodes
      if (node.isRoot) {
        context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
        context.lineWidth = 3;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
      }

      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `bold ${fontSize}px Inter, -apple-system, sans-serif`;
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);

      const aspectRatio = canvas.width / canvas.height;
      // Larger 3D node size for enhanced visibility
      sprite.scale.set(node.isRoot ? 55 * aspectRatio : 38 * aspectRatio, node.isRoot ? 55 : 38, 1);
      sprite.position.y = node.isRoot ? 7 : 5;
      group.add(sprite);
    }

    return group;
  }, [isDark]);

  const handleNodeClick = useCallback((node: any) => {
    lastNodeClickAt.current = Date.now();
    if (fgRef.current) {
      const distance = 240; // Closer focus distance
      const hypot = Math.hypot(node.x || 0, node.y || 0, node.z || 0);

      let camPos;
      // Prevent divide-by-zero Infinity math when clicking the root (0,0,0) center node
      if (hypot < 0.1 || isNaN(hypot)) {
        camPos = { x: 0, y: 0, z: distance };
      } else {
        const distRatio = 1 + distance / hypot;
        camPos = { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio };
      }

      fgRef.current.cameraPosition(
        camPos,
        node,
        1000
      );
    }
    setSelectedNodeId(node.id);
    onNodeClick(node);
  }, [onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-transparent">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        width={dims.width}
        height={dims.height}
        backgroundColor="rgba(0,0,0,0)"
        nodeAutoColorBy="id"
        nodeThreeObject={nodeThreeObject}
        linkWidth={1.8}
        linkColor={() => mindMapLink3dColor(isDark)}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => {
          // ForceGraph3D can sometimes emit background click right after a node click.
          // If a node click just happened, ignore this to prevent the "zoomToFit" reset flicker.
          const elapsed = Date.now() - lastNodeClickAt.current;
          if (elapsed < 700) return;

          if (fgRef.current && selectedNodeId) {
            applyTightZoom(1000);
            setSelectedNodeId(null);
            if (onBackgroundClick) onBackgroundClick();
          }
        }}
        enablePointerInteraction={true}
        enableNodeDrag={false}
        enableNavigationControls={true}
        showNavInfo={false}
        cooldownTicks={0}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.35}
        onEngineStop={() => {
          if (fgRef.current && graphData.nodes.length > 0 && !hasFittedInitial.current) {
            setTimeout(() => {
              if (fgRef.current) {
                applyTightZoom(800);
                hasFittedInitial.current = true;
              }
            }, 600);
          }
        }}
      />
    </div>
  );
});

MindMap3D.displayName = 'MindMap3D';
