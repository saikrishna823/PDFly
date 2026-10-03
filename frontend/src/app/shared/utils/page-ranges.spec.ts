import { formatPageRanges, parsePageRanges } from './page-ranges';

describe('parsePageRanges', () => {
  it('parses single pages, ranges and open-ended ranges', () => {
    expect(parsePageRanges('1-3, 5, 8-', 10)).toEqual({ ok: true, pages: [1, 2, 3, 5, 8, 9, 10] });
    expect(parsePageRanges('-2', 10)).toEqual({ ok: true, pages: [1, 2] });
    expect(parsePageRanges(' 4 ; 2 4 ', 10)).toEqual({ ok: true, pages: [2, 4] });
    expect(parsePageRanges('2–4', 10)).toEqual({ ok: true, pages: [2, 3, 4] });
  });

  it('explains invalid input', () => {
    expect(parsePageRanges('', 5)).toEqual({ ok: false, error: 'Enter page numbers, for example 1-3, 5.' });
    expect(parsePageRanges('abc', 5)).toMatchObject({ ok: false, error: expect.stringContaining('"abc"') });
    expect(parsePageRanges('7', 5)).toMatchObject({ ok: false, error: expect.stringContaining('5 pages') });
    expect(parsePageRanges('0', 5)).toMatchObject({ ok: false });
    expect(parsePageRanges('4-2', 5)).toMatchObject({ ok: false, error: expect.stringContaining('2-4') });
  });
});

describe('formatPageRanges', () => {
  it('collapses consecutive pages', () => {
    expect(formatPageRanges([8, 1, 2, 3, 5, 7])).toBe('1–3, 5, 7–8');
    expect(formatPageRanges([4])).toBe('4');
    expect(formatPageRanges([])).toBe('');
  });
});
