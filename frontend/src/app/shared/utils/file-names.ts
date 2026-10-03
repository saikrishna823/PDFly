/** "Holiday photo.final.jpg" → "Holiday photo.final" */
export function fileStem(name: string): string {
  const base = name.split(/[\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return stem.trim() || 'document';
}

/** Build an output name such as "report-page-1.png" from an input file name. */
export function deriveFileName(sourceName: string, suffix: string, extension: string): string {
  return `${fileStem(sourceName)}${suffix}.${extension.replace(/^\./, '')}`;
}
