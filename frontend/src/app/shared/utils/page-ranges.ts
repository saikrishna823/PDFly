export type PageRangeResult = { ok: true; pages: number[] } | { ok: false; error: string };

/**
 * Parse a human page list such as "1-3, 5, 8-" into sorted, unique page numbers.
 * An open-ended range ("8-") runs to the last page.
 */
export function parsePageRanges(input: string, pageCount: number): PageRangeResult {
  const parts = input
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    return { ok: false, error: 'Enter page numbers, for example 1-3, 5.' };
  }

  const pages = new Set<number>();
  for (const part of parts) {
    const match = /^(\d+)?\s*[-–]\s*(\d+)?$|^(\d+)$/.exec(part);
    if (!match) {
      return { ok: false, error: `"${part}" isn't a page number or range.` };
    }
    const single = match[3];
    const start = Number(single ?? match[1] ?? 1);
    const end = Number(single ?? match[2] ?? pageCount);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      return { ok: false, error: `This PDF has ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}; "${part}" is out of range.` };
    }
    if (start > end) {
      return { ok: false, error: `"${part}" counts backwards. Try ${end}-${start}.` };
    }
    for (let page = start; page <= end; page++) {
      pages.add(page);
    }
  }
  return { ok: true, pages: [...pages].sort((a, b) => a - b) };
}

/** [1, 2, 3, 5, 7, 8] → "1–3, 5, 7–8" */
export function formatPageRanges(pages: Iterable<number>): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}–${sorted[i]}`);
  }
  return ranges.join(', ');
}
