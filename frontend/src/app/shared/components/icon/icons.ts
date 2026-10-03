// Minimal 24×24 stroke icons, expressed as SVG path data so they render without
// innerHTML or an icon font.

const rect = (x: number, y: number, w: number, h: number, r: number): string =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}` +
  `h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`;

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0`;

const FILE = 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5';

export const ICONS = {
  upload: ['M12 15V4', 'M7 9l5-5 5 5', 'M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4'],
  image: [rect(3, 4, 18, 16, 2), circle(9, 10, 2), 'M21 16l-5-5-9 9'],
  images: [rect(7, 3, 14, 13, 2), 'M17 20H6a3 3 0 0 1-3-3V8', circle(12, 8, 1.5), 'M21 13l-4-4-6 6'],
  'file-image': [FILE, circle(10, 12, 1.5), 'M19 17l-3-3-6 6'],
  'file-text': [FILE, 'M9 12h6', 'M9 16h6', 'M9 8h2'],
  'file-edit': [FILE, 'M9 12h3', 'M10 19l.5-2.5 4.5-4.5 2 2-4.5 4.5z'],
  file: [FILE],
  shield: ['M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z', 'M9 12l2 2 4-4'],
  device: [rect(4, 5, 16, 11, 1.5), 'M2 19h20'],
  server: [rect(3, 4, 18, 7, 2), rect(3, 13, 18, 7, 2), 'M7 7.5h.01', 'M7 16.5h.01'],
  check: ['M5 12l5 5 9-10'],
  'check-circle': [circle(12, 12, 9), 'M8 12.5l3 3 5-6'],
  alert: [circle(12, 12, 9), 'M12 7.5v5.5', 'M12 16.5h.01'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  'rotate-cw': ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
  'rotate-ccw': ['M4 12a8 8 0 1 0 2.34-5.66', 'M4 4v5h5'],
  'arrow-left': ['M19 12H5', 'M11 6l-6 6 6 6'],
  'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  plus: ['M12 5v14', 'M5 12h14'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
