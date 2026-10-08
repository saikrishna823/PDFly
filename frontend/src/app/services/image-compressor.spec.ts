import { chooseMime, fitToSize } from './image-compressor';

/** Fake encoder: size grows with pixel count (scale²) and quality. */
function fakeEncoder(baseBytes: number) {
  const calls: { scale: number; quality: number }[] = [];
  const encode = async (scale: number, quality: number) => {
    calls.push({ scale, quality });
    const size = Math.round(baseBytes * scale * scale * (0.1 + quality));
    return new Blob([new Uint8Array(size)]);
  };
  return { encode, calls };
}

describe('fitToSize', () => {
  it('returns top quality straight away when it already fits', async () => {
    const { encode, calls } = fakeEncoder(1000);
    const result = await fitToSize(encode, 5000, 1, 4000);
    expect(result.met).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].quality).toBeCloseTo(0.95);
  });

  it('finds the highest quality that fits without resizing', async () => {
    const { encode } = fakeEncoder(1_000_000);
    const result = await fitToSize(encode, 500_000, 1, 4000);
    expect(result.met).toBe(true);
    expect(result.scale).toBe(1);
    expect(result.blob.size).toBeLessThanOrEqual(500_000);
    expect(result.blob.size).toBeGreaterThan(450_000); // close to the target, not needlessly small
  });

  it('shrinks dimensions when even the lowest quality is too big', async () => {
    const { encode } = fakeEncoder(10_000_000);
    const result = await fitToSize(encode, 200_000, 1, 4000);
    expect(result.met).toBe(true);
    expect(result.scale).toBeLessThan(1);
    expect(result.blob.size).toBeLessThanOrEqual(200_000);
  });

  it('reports failure with the smallest attempt when the target is impossible', async () => {
    const { encode } = fakeEncoder(10_000_000);
    const result = await fitToSize(encode, 10, 1, 100);
    expect(result.met).toBe(false);
    expect(result.blob.size).toBeGreaterThan(10);
  });
});

describe('chooseMime', () => {
  it('keeps lossy formats and converts PNG by transparency in auto mode', () => {
    expect(chooseMime('auto', 'jpeg', false)).toBe('image/jpeg');
    expect(chooseMime('auto', 'webp', true)).toBe('image/webp');
    expect(chooseMime('auto', 'png', false)).toBe('image/jpeg');
    expect(chooseMime('auto', 'png', true)).toBe('image/webp');
  });

  it('honours an explicit format', () => {
    expect(chooseMime('png', 'jpeg', false)).toBe('image/png');
    expect(chooseMime('webp', 'jpeg', false)).toBe('image/webp');
    expect(chooseMime('jpeg', 'png', true)).toBe('image/jpeg');
  });
});
