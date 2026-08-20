// Solid (not translucent) fills — these chips now sit on a white canvas
// instead of black, so they carry their own contrast rather than relying on
// a dark backdrop to read as "dark cards".
export const MIND_MAP_COLORS = [
  'bg-blue-600 border-blue-700 text-white',
  'bg-emerald-600 border-emerald-700 text-white',
  'bg-purple-600 border-purple-700 text-white',
  'bg-amber-600 border-amber-700 text-white',
  'bg-rose-600 border-rose-700 text-white',
];

export const MIND_MAP_HEX_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

export const MIND_MAP_THEME = {
  name: 'Light',
  bg: '#FFFFFF',
  gridColor: '#E2E2E2',
  edgeColor: '#722f37',
  rootClass: 'bg-[#722f37] border-[#5a252c] text-white font-bold shadow-[0_0_15px_rgba(114,47,55,0.3)]',
  nodeClass: (i: number) => MIND_MAP_COLORS[i % MIND_MAP_COLORS.length],
};
