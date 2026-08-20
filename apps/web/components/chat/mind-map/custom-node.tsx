import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export const CustomNode = memo(({ data }: any) => {
  const isVertical = data.layout === 'vertical';
  const isRadial = data.layout === 'radial';
  const isDual = data.layout === 'dual';
  const isLeft = data.side === 'left';
  const isRight = data.side === 'right';
  const isTop = data.side === 'top';
  const isBottom = data.side === 'bottom';

  // Logic to determine handle positions based on layout
  let targetPos = Position.Left;
  let sourcePos = Position.Right;

  if (isVertical) {
    targetPos = Position.Top;
    sourcePos = Position.Bottom;
  } else if (isDual || isRadial) {
    // Advanced positioning for Radial/Dual
    if (isLeft) {
      targetPos = Position.Right;
      sourcePos = Position.Left;
    } else if (isRight) {
      targetPos = Position.Left;
      sourcePos = Position.Right;
    } else if (isTop) {
      targetPos = Position.Bottom;
      sourcePos = Position.Top;
    } else if (isBottom) {
      targetPos = Position.Top;
      sourcePos = Position.Bottom;
    }
  }

  // Root nodes in Dual/Radial need multi-directional branching
  const isMultiPort = data.isRoot && (isDual || isRadial);

  const hasImageOrAudio = data.media?.some((m: any) => m.type === 'image' || m.type === 'audio');

  return (
    <div className={`${hasImageOrAudio ? 'px-3 py-2 max-w-[180px] min-w-[140px]' : 'px-8 py-5 min-w-[280px] max-w-[450px]'} rounded-xl ${data.isRoot ? 'border-[4px]' : ''} transition-all duration-300 group relative cursor-pointer hover:shadow-[0_0_30px_rgba(114,47,55,0.25)] hover:scale-[1.05] ${data.className || 'bg-slate-700 border-slate-800'}`}>

      {/* Target Handle - Root doesn't usually have one, others do */}
      {!data.isRoot && (
        <Handle
          type="target"
          position={targetPos}
          className="!w-0 !h-0 opacity-0 pointer-events-none"
        />
      )}

      {/* Root Multi-Ports for Dual/Radial */}
      {isMultiPort && (
        <>
          <Handle type="source" position={Position.Left} id="left" className="!w-0 !h-0 opacity-0 pointer-events-none" />
          <Handle type="source" position={Position.Right} id="right" className="!w-0 !h-0 opacity-0 pointer-events-none" />
          <Handle type="source" position={Position.Top} id="top" className="!w-0 !h-0 opacity-0 pointer-events-none" />
          <Handle type="source" position={Position.Bottom} id="bottom" className="!w-0 !h-0 opacity-0 pointer-events-none" />
        </>
      )}

      {/* Primary Source Handle for standard branching */}
      {!isMultiPort && (
        <Handle
          type="source"
          position={sourcePos}
          className="!w-0 !h-0 opacity-0 pointer-events-none"
        />
      )}

      <div className="flex flex-col gap-1">
        {/* Label — compact header when media is present, large when text-only */}
        <div className={`font-black leading-tight text-center text-white ${data.isRoot
            ? 'text-[42px]'
            : data.media && data.media.length > 0
              ? 'text-[20px] font-bold opacity-90 uppercase tracking-wider truncate'
              : 'text-[32px]'
          }`}>
          {data.label}
        </div>

        {/* Rich Media Embedding directly ON the Node for Lawyers */}
        {data.media && data.media.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {data.media.map((item: any, idx: number) => {
              const url = item?.url;
              const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');
              const isMissingUrl = !url || url === '#' || isBlobUrl;

              if (item.type === 'image') {
                if (isMissingUrl) {
                  return (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-xl border-2 border-dashed border-white/20 bg-white/5 shadow-lg flex items-center justify-center p-3 min-h-[90px]"
                    >
                      <span className="text-[10px] text-white/60 font-semibold text-center">
                        {item.name || 'Image'} Preview Not Available
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="relative group/media overflow-hidden rounded-xl border-2 border-white/10 shadow-lg">
                    <img
                      src={url}
                      alt={item.name}
                      className="w-full h-auto max-h-[220px] object-cover transition-transform group-hover/media:scale-105"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1">
                      <span className="text-[10px] text-white/70 truncate block">{item.name}</span>
                    </div>
                  </div>
                );
              }

              if (item.type === 'audio') {
                if (isMissingUrl) {
                  return (
                    <div
                      key={idx}
                      className="flex flex-col gap-1.5 w-full bg-[#050505]/60 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-lg"
                    >
                      <span className="text-[10px] font-bold text-[#e9c176] truncate uppercase tracking-widest leading-none mb-1">
                        Audio File
                      </span>
                      <div className="w-full h-8 rounded-md bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-[10px] text-white/50">
                        Preview Not Available
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="flex flex-col gap-1.5 w-full bg-[#050505]/60 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-lg">
                    <span className="text-[10px] font-bold text-[#e9c176] truncate uppercase tracking-widest leading-none mb-1">Audio File</span>
                    <audio controls className="w-full h-9 rounded-md">
                      <source src={url} />
                    </audio>
                  </div>
                );
              }

              if (item.type === 'file') {
                if (isMissingUrl) {
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-[#0A0A0A] p-2.5 rounded-xl border border-white/10 shadow-lg"
                    >
                      <div className="bg-[#e9c176] text-black w-8 h-8 flex items-center justify-center rounded-lg font-bold text-lg shrink-0">📄</div>
                      <span className="text-sm font-medium truncate text-white/60">{item.name} (URL expired)</span>
                    </div>
                  );
                }

                return (
                  <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-[#0B0B0C] p-3 rounded-xl border border-white/5 hover:bg-[#722f37]/10 hover:border-[#e9c176]/50 transition-all shadow-xl group/file">
                    <div className="bg-[#e9c176] text-black w-8 h-8 flex items-center justify-center rounded-lg font-bold text-lg shrink-0 shadow-lg group-hover/file:scale-110 transition-transform">📄</div>
                    <span className="text-sm font-medium truncate text-white/90">{item.name}</span>
                  </a>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
