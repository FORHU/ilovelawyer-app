'use client';

import React, { useRef, useMemo, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { MindMapItem } from './types';
import { MIND_MAP_HEX_COLORS, mindMapLink3dColor, fixedNodeDescription } from './constants';

export interface MindMap3DProps {
  root: MindMapItem | null;
  rootTitle: string;
  isDark?: boolean;
  onNodeClick: (node: any) => void;
  onBackgroundClick?: () => void;
  /** The parent's selected node (index.tsx) — drives the focus effect, so closing the details
   * panel with its × also un-blurs the map, not just a background click in here. */
  focusedNodeId?: string | null;
}

export interface MindMap3DHandle {
  recenter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export const MindMap3D = forwardRef<MindMap3DHandle, MindMap3DProps>(({ root, rootTitle, isDark = false, onNodeClick, onBackgroundClick, focusedNodeId }, ref) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const hasFittedInitial = useRef(false);
  const lastNodeClickAt = useRef<number>(0);
  const focusId = focusedNodeId !== undefined ? focusedNodeId : selectedNodeId;
  const focusIdRef = useRef(focusId);
  focusIdRef.current = focusId;
  // One entry per rendered label sprite, so focus can be applied by swapping textures in place
  // rather than rebuilding every node's three.js object on each click.
  const labelsRef = useRef(new Map<string, NodeLabel>());

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

    // Ring radius per depth. A fixed 240 per level crowded a busy ring until its labels sat on
    // top of each other — each ring is pushed out until its nodes get at least a label's width
    // of arc apiece, and always at least 240 beyond the ring inside it.
    const depthCounts: number[] = [];
    const countDepths = (item: any, depth: number) => {
      depthCounts[depth] = (depthCounts[depth] ?? 0) + 1;
      getChildren(item).forEach((c: any) => countDepths(c, depth + 1));
    };
    countDepths(root, 0);
    const ringRadius: number[] = [0];
    for (let d = 1; d < depthCounts.length; d++) {
      ringRadius[d] = Math.max(ringRadius[d - 1]! + 240, (depthCounts[d]! * MIN_LABEL_ARC) / (2 * Math.PI));
    }

    // 2. Leaf-Weighted Concentric Radial Layout
    // `branch` = which first-level branch the node is under (-1 for the root): the whole branch
    // shares one colour, same as the 2D canvas (layout.ts).
    const traverse = (item: any, depth = 0, angleStart = 0, angleEnd = 2 * Math.PI, branch = -1) => {
      const isRoot = depth === 0;
      const nodeId = getId(item);
      let label = getLabel(item);

      if (isRoot && (label === 'Case Analysis' || label === 'Legal Strategy Map')) {
        label = rootTitle;
      }

      const midAngle = (angleStart + angleEnd) / 2;
      const radius = ringRadius[depth] ?? depth * 240;

      const x = radius * Math.cos(midAngle);
      const y = radius * Math.sin(midAngle);

      // True 3D Scatter: Create a 'saddle curve' by sweeping the Z-axis up and down
      // based on the branch's rotation, resulting in a stunning spherical constellation.
      const zWave = Math.sin(midAngle * 3) * (radius * 0.85);
      const z = isRoot ? 0 : zWave + (depth % 2 === 0 ? 40 : -40);

      const colors = MIND_MAP_HEX_COLORS;
      const paletteIndex = Math.max(0, branch);

      nodes.push({
        id: nodeId,
        label,
        // Root + the five fixed first-level nodes get a static description; deeper nodes keep
        // the model's. See MIND_MAP_FIXED_NODE_DESCRIPTIONS.
        description: fixedNodeDescription({ id: nodeId, label: getLabel(item), isRoot }) ?? getDescription(item),
        media: getMedia(item),
        isRoot,
        fx: x, fy: y, fz: z,
        color: isRoot ? '#722f37' : colors[paletteIndex % colors.length]
      });

      const children = getChildren(item);
      if (children.length > 0) {
        const totalLeaves = leafMap.get(item.id);
        let currentAngle = angleStart;

        children.forEach((child: any, index: number) => {
          const childId = getId(child);
          links.push({ source: nodeId, target: childId });

          const childLeaves = leafMap.get(childId);
          const angleShare = (childLeaves / (totalLeaves || 1)) * (angleEnd - angleStart);

          traverse(child, depth + 1, currentAngle, currentAngle + angleShare, isRoot ? index : branch);
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
    const sharp = drawLabelCanvas(node, isDark, false);
    if (!sharp) return group;

    const textures = {
      normal: new THREE.CanvasTexture(sharp),
      focus: new THREE.CanvasTexture(drawLabelCanvas(node, isDark, true) ?? sharp),
      blur: new THREE.CanvasTexture(blurCanvas(sharp)),
    };
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.normal, transparent: true }));

    const aspectRatio = sharp.width / sharp.height;
    // Larger 3D node size for enhanced visibility
    const baseHeight = node.isRoot ? 55 : 38;
    sprite.scale.set(baseHeight * aspectRatio, baseHeight, 1);
    sprite.position.y = node.isRoot ? 7 : 5;
    group.add(sprite);

    const previous = labelsRef.current.get(node.id);
    if (previous) Object.values(previous.textures).forEach((t) => t.dispose());
    const label: NodeLabel = { sprite, textures, baseScale: { x: baseHeight * aspectRatio, y: baseHeight } };
    labelsRef.current.set(node.id, label);
    applyLabelFocus(label, node.id, focusIdRef.current);

    return group;
  }, [isDark]);

  // Focus mode: the clicked node is drawn sharp, highlighted, slightly enlarged and on top of
  // anything overlapping it; every other label swaps to a blurred, faded texture.
  useEffect(() => {
    labelsRef.current.forEach((label, id) => applyLabelFocus(label, id, focusId));
  }, [focusId]);

  useEffect(() => {
    const labels = labelsRef.current;
    return () => {
      labels.forEach((label) => Object.values(label.textures).forEach((t) => t.dispose()));
      labels.clear();
    };
  }, []);

  // Links touching the focused node stand out; the rest fade with the blurred labels.
  const linkColor = useCallback((link: any) => {
    const base = mindMapLink3dColor(isDark);
    if (!focusId) return base;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return sourceId === focusId || targetId === focusId ? (isDark ? '#ffffff' : '#1f2937') : `${base}33`;
  }, [isDark, focusId]);

  // Covered strip of the canvas: the details card (index.tsx's [data-mind-map-detail]) sits on
  // the right from md up, and as a bottom sheet below that. Measured rather than assumed, since
  // the canvas can be any width (a narrow Terminal pane vs full screen).
  const measureCoveredArea = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { coveredX: 0, coveredY: 0 };
    let scope: HTMLElement | null = container.parentElement;
    let card: Element | null = null;
    for (let i = 0; scope && i < 6 && !card; i++, scope = scope.parentElement) {
      card = scope.querySelector('[data-mind-map-detail]');
    }
    if (!card) return { coveredX: 0, coveredY: 0 };
    const c = container.getBoundingClientRect();
    const p = card.getBoundingClientRect();
    const margin = 24;
    return p.width < c.width * 0.8
      ? { coveredX: Math.max(0, c.right - p.left + margin), coveredY: 0 }
      : { coveredX: 0, coveredY: Math.max(0, c.bottom - p.top + margin) };
  }, []);

  const focusCameraOn = useCallback((node: any) => {
    if (!fgRef.current) return;
    const camera = fgRef.current.camera() as THREE.PerspectiveCamera;
    const nodePos = new THREE.Vector3(node.x || 0, node.y || 0, node.z || 0);
    const hypot = nodePos.length();
    // View direction: straight out from the centre through the node. The root sits at (0,0,0),
    // so it's viewed head-on instead (avoids divide-by-zero Infinity math).
    const outward = hypot < 0.1 || isNaN(hypot) ? new THREE.Vector3(0, 0, 1) : nodePos.clone().divideScalar(hypot);

    const { width, height } = dims;
    let { coveredX, coveredY } = measureCoveredArea();
    // Card covers nearly everything (very narrow canvas) — nowhere beside it to frame the node.
    if (width - coveredX < 160) coveredX = 0;
    if (height - coveredY < 120) coveredY = 0;
    const freeW = width - coveredX;
    const freeH = height - coveredY;

    // Back off far enough that the whole (focused, enlarged) label fits that free space.
    const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360);
    const label = labelsRef.current.get(node.id);
    const labelW = (label?.baseScale.x ?? 0) * FOCUS_SCALE;
    const labelH = (label?.baseScale.y ?? 0) * FOCUS_SCALE;
    const pxToDistance = height / (2 * tanHalfFov);
    const distance = Math.max(240, (labelW / (freeW * 0.75)) * pxToDistance, (labelH / (freeH * 0.5)) * pxToDistance);

    // Shift camera and target together (keeping the view direction) so the node lands in the
    // middle of the free space: left of the card on desktop, above the sheet on mobile.
    const worldPerPx = (2 * distance * tanHalfFov) / height;
    const forward = outward.clone().negate();
    let right = new THREE.Vector3().crossVectors(forward, camera.up);
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 0, 1));
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const offset = right
      .multiplyScalar((coveredX / 2) * worldPerPx)
      .add(up.multiplyScalar(-(coveredY / 2) * worldPerPx));

    const target = nodePos.clone().add(offset);
    const camPos = target.clone().add(outward.multiplyScalar(distance));

    fgRef.current.cameraPosition(
      { x: camPos.x, y: camPos.y, z: camPos.z },
      { x: target.x, y: target.y, z: target.z },
      1000
    );
  }, [dims, measureCoveredArea]);

  const handleNodeClick = useCallback((node: any) => {
    lastNodeClickAt.current = Date.now();
    setSelectedNodeId(node.id);
    onNodeClick(node);
    // Wait for the parent's details card to mount and lay out so it can be measured.
    requestAnimationFrame(() => requestAnimationFrame(() => focusCameraOn(node)));
  }, [onNodeClick, focusCameraOn]);

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
        linkColor={linkColor}
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

interface NodeLabel {
  sprite: THREE.Sprite;
  textures: { normal: THREE.CanvasTexture; focus: THREE.CanvasTexture; blur: THREE.CanvasTexture };
  baseScale: { x: number; y: number };
}

// Arc each label needs on its ring (see ringRadius) — roughly one label sprite's width.
const MIN_LABEL_ARC = 260;
const FOCUS_SCALE = 1.18;
const BLUR_PADDING = 24;

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1]!, 16), g: parseInt(result[2]!, 16), b: parseInt(result[3]!, 16) }
    : { r: 255, g: 255, b: 255 };
}

/** One node's label as a canvas. `focused` draws the selected-node variant — an opaque fill and a
 * glowing white border — at the same size, so swapping textures never shifts the sprite. */
function drawLabelCanvas(node: any, isDark: boolean, focused: boolean): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

  const text = node.label || '';
  const fontSize = 48;
  const font = `bold ${fontSize}px Inter, -apple-system, sans-serif`;
  context.font = font;
  const textWidth = context.measureText(text).width;

  canvas.width = textWidth + 100;
  canvas.height = fontSize + 50;

  const rgb = hexToRgb(node.color);

  // Semi-transparent colored background (20% opacity like Tailwind's /20); opaque when focused
  const fillAlpha = focused ? 0.95 : isDark ? 0.28 : 0.92;
  context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillAlpha})`;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (focused) {
    context.save();
    context.shadowColor = 'rgba(255, 255, 255, 0.9)';
    context.shadowBlur = 18;
    context.strokeStyle = '#ffffff';
    context.lineWidth = 5;
    context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    context.restore();
  } else if (node.isRoot) {
    // Colored border matching node color (50% opacity) - only for root nodes
    context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
    context.lineWidth = 3;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  }

  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = font;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas;
}

/** A blurred copy of a label canvas, same size. Drawn inset by BLUR_PADDING so the blur fades out
 * inside the canvas instead of being cut off at its edges. Browsers without canvas `filter`
 * support just get the (still faded) sharp label. */
function blurCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.filter = 'blur(6px)';
  context.drawImage(
    source,
    BLUR_PADDING,
    BLUR_PADDING / 2,
    source.width - BLUR_PADDING * 2,
    source.height - BLUR_PADDING,
  );
  return canvas;
}

function applyLabelFocus(label: NodeLabel, id: string, focusId: string | null) {
  const { sprite, textures, baseScale } = label;
  const material = sprite.material;
  const isFocused = focusId === id;
  const isBlurred = !!focusId && !isFocused;

  const map = isFocused ? textures.focus : isBlurred ? textures.blur : textures.normal;
  if (material.map !== map) {
    material.map = map;
    material.needsUpdate = true;
  }
  material.opacity = isBlurred ? 0.35 : 1;
  // Focused label ignores depth so overlapping labels can't cover it.
  material.depthTest = !isFocused;
  sprite.renderOrder = isFocused ? 999 : 0;
  const scale = isFocused ? FOCUS_SCALE : 1;
  sprite.scale.set(baseScale.x * scale, baseScale.y * scale, 1);
}
