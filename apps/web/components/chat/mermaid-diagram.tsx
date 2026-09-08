"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Plus, Minus, Target } from "lucide-react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const PADDING = 24;

type View = { scale: number; x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Renders a mermaid code fence (e.g. the AI's "Visual Case Strategy Map" flowcharts) as an
// actual SVG diagram, pan/zoomable the same way the ReactFlow mind map is — fit-to-view on
// load, wheel to zoom, drag to pan, +/-/fit controls — instead of a fixed-size image the
// user has to scroll around to read.
export function MermaidDiagram({ chart }: { chart: string }) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);
  const dragStateRef = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [ready, setReady] = useState(false);

  const fitToView = useCallback(() => {
    const natural = naturalSizeRef.current;
    const viewport = viewportRef.current;
    if (!natural || !viewport) return;
    const availableWidth = viewport.clientWidth - PADDING * 2;
    const availableHeight = viewport.clientHeight - PADDING * 2;
    const scale = clamp(Math.min(availableWidth / natural.width, availableHeight / natural.height, 1), MIN_SCALE, MAX_SCALE);
    setView({
      scale,
      x: (viewport.clientWidth - natural.width * scale) / 2,
      y: (viewport.clientHeight - natural.height * scale) / 2,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Reset from a possible previous render (e.g. a re-generated chart) before the new one loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setReady(false);

    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === "dark" ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: "Inter, sans-serif",
        // We do our own fit/zoom below — mermaid's own useMaxWidth scaling would otherwise
        // fight with it by shrinking the SVG to the container width on its own.
        flowchart: { useMaxWidth: false },
        mindmap: { useMaxWidth: false },
        sequence: { useMaxWidth: false },
      });

      mermaid
        .render(`mermaid-${rawId}`, chart.trim())
        .then(({ svg, bindFunctions }) => {
          if (cancelled || !containerRef.current) return;
          containerRef.current.innerHTML = svg;
          bindFunctions?.(containerRef.current);

          const svgEl = containerRef.current.querySelector("svg");
          const width = svgEl?.viewBox?.baseVal?.width || svgEl?.getBoundingClientRect().width || 0;
          const height = svgEl?.viewBox?.baseVal?.height || svgEl?.getBoundingClientRect().height || 0;
          naturalSizeRef.current = { width: width || 1, height: height || 1 };
          setReady(true);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [chart, rawId, resolvedTheme]);

  // Fit once the diagram's natural size is known (and again if the viewport is resized).
  useEffect(() => {
    if (!ready) return;
    fitToView();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => fitToView());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [ready, fitToView]);

  // Native (non-passive) wheel listener — React's onWheel is passive by default, which would
  // let the zoom gesture also scroll the surrounding chat feed instead of only the diagram.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

      setView((prev) => {
        const newScale = clamp(prev.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
        const scaleRatio = newScale / prev.scale;
        return {
          scale: newScale,
          x: pointerX - (pointerX - prev.x) * scaleRatio,
          y: pointerY - (pointerY - prev.y) * scaleRatio,
        };
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);

  const zoomByStep = useCallback((factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    setView((prev) => {
      const newScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
      const scaleRatio = newScale / prev.scale;
      return {
        scale: newScale,
        x: centerX - (centerX - prev.x) * scaleRatio,
        y: centerY - (centerY - prev.y) * scaleRatio,
      };
    });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStateRef.current = { pointerX: e.clientX, pointerY: e.clientY, viewX: view.x, viewY: view.y };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = dragStateRef.current;
    if (!start) return;
    setView((prev) => ({
      ...prev,
      x: start.viewX + (e.clientX - start.pointerX),
      y: start.viewY + (e.clientY - start.pointerY),
    }));
  };

  const stopDragging = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  if (error) {
    return (
      <pre className="bg-muted rounded-lg p-3 text-[13px] font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap">
        {chart}
      </pre>
    );
  }

  return (
    <div className="my-3 relative rounded-xl border border-border bg-muted/40 overflow-hidden">
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
        className={`h-[420px] w-full select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div
          ref={containerRef}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
          className="w-fit [&_svg]:block [&_svg]:max-w-none"
        />
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => zoomByStep(1 / 1.3)}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Zoom out"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={fitToView}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Fit to view"
        >
          <Target size={14} />
        </button>
        <button
          type="button"
          onClick={() => zoomByStep(1.3)}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Zoom in"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
