// Solid (not translucent) fills — chips carry their own contrast on both
// light and dark canvases rather than relying on the backdrop.
export const MIND_MAP_COLORS = [
  'bg-blue-600 border-blue-700 text-white',
  'bg-emerald-600 border-emerald-700 text-white',
  'bg-purple-600 border-purple-700 text-white',
  'bg-amber-600 border-amber-700 text-white',
  'bg-rose-600 border-rose-700 text-white',
];

export const MIND_MAP_HEX_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

export const MIND_MAP_THEME = {
  name: 'Brand',
  edgeColor: '#722f37',
  rootClass: 'bg-[#722f37] border-[#5a252c] text-white font-bold shadow-[0_0_15px_rgba(114,47,55,0.3)]',
  nodeClass: (i: number) => MIND_MAP_COLORS[i % MIND_MAP_COLORS.length],
};

export function mindMapGridColor(isDark: boolean) {
  return isDark ? '#1d2a47' : '#E2E2E2';
}

export function mindMapLink3dColor(isDark: boolean) {
  return isDark ? '#3a4a6c' : '#c5c9d4';
}

/** Chrome around the canvas — semantic tokens so light/dark follow the app theme. */
export const MIND_MAP_CHROME = {
  canvas:
    'bg-background border-border shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
  loading3d:
    'w-full h-full bg-muted/40 animate-pulse flex items-center justify-center text-muted-foreground text-xs font-black uppercase tracking-widest',
  toggleOff:
    'flex items-center gap-2 px-3 py-1 md:px-3.5 md:py-1.5 rounded-full backdrop-blur-md shadow-lg transition-all border border-border bg-card/90 text-foreground font-black',
  toggleOn:
    'flex items-center gap-2 px-3 py-1 md:px-3.5 md:py-1.5 rounded-full backdrop-blur-md shadow-lg transition-all border border-foreground bg-foreground text-background font-black',
  accentBtn:
    'flex items-center gap-1.5 px-4 py-2 rounded-xl backdrop-blur-md shadow-lg transition-all border border-brand-gold/30 bg-brand-gold text-brand-navy-950 font-bold hover:scale-105 active:scale-95 uppercase tracking-widest text-[10px]',
  fullBtn:
    'flex items-center gap-2 px-5 py-2 rounded-xl backdrop-blur-md shadow-lg transition-all border border-brand-gold/30 bg-brand-gold text-brand-navy-950 font-bold hover:scale-105 active:scale-95 uppercase tracking-[0.2em] text-[10px]',
  menu: 'absolute top-full left-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-2xl z-[210] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200',
  menuHeader: 'p-2 border-b border-border bg-muted/50 text-center',
  menuHeaderLabel: 'text-[8px] uppercase tracking-widest font-black text-muted-foreground',
  menuItem:
    'w-full px-4 py-3 flex items-center justify-between rounded-xl hover:bg-muted transition-all text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
  menuItemActive:
    'w-full px-4 py-3 flex items-center justify-between rounded-xl bg-muted border border-border transition-all text-[10px] font-bold uppercase tracking-widest text-foreground',
  hub: 'absolute bottom-6 left-4 md:left-6 z-[100000] flex flex-col items-center gap-1 p-1 rounded-full bg-card/95 backdrop-blur-3xl border border-border shadow-lg w-max pointer-events-auto transition-all scale-90 md:scale-100 origin-bottom-left',
  hubGroup: 'flex flex-col items-center gap-0.5 pb-1 border-b border-border',
  hubBtn:
    'p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all active:scale-95 border border-transparent hover:border-border',
  hubBtnSm:
    'p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all active:scale-95',
  hubBtnActive:
    'p-1.5 rounded-full transition-all active:scale-95 border bg-muted text-foreground border-border flex items-center justify-center',
  hubBtnIdle:
    'p-1.5 rounded-full transition-all active:scale-95 border border-transparent text-muted-foreground hover:bg-muted flex items-center justify-center',
  hubDivider: 'w-3 h-[1px] bg-border',
  memory:
    'absolute left-[calc(100%+8px)] bottom-0 w-max min-w-[240px] p-2.5 rounded-2xl bg-popover border border-border shadow-xl animate-in fade-in slide-in-from-left-1',
  memoryTitle:
    'text-[10px] font-black text-foreground uppercase tracking-[0.25em] mb-4 pb-2 border-b border-border px-1',
  memoryRow:
    'flex items-center justify-between p-1.5 px-2.5 rounded-xl bg-muted/40 border border-border hover:border-foreground/20 group/item transition-all',
  memoryIndex:
    'w-6 h-6 flex items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border group-hover/item:text-foreground transition-all',
  memorySave:
    'px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-gold hover:bg-brand-gold/10 rounded-lg transition-all',
  memoryLoad:
    'px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-foreground hover:bg-muted rounded-lg transition-all',
  detail:
    'absolute z-[99999] bg-card/95 backdrop-blur-2xl border border-border rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden inset-x-4 bottom-4 md:inset-auto md:top-28 md:right-10 md:w-[320px]',
  detailTitle: 'text-xl font-bold text-foreground leading-tight truncate',
  detailClose:
    'p-1 -mt-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 bg-muted rounded-full hover:bg-muted/80',
  detailLabel: 'text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold',
  detailBody: 'text-[14px] text-muted-foreground leading-relaxed font-medium',
  detailStrong: 'text-foreground font-bold',
  audioBar:
    'absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[85vw] max-w-[760px] z-[99998] bg-card/95 backdrop-blur-xl border-t border-border px-6 py-6 shadow-2xl rounded-t-2xl',
};
