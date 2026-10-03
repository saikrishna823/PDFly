import { DEFAULT_IMAGE_PDF_OPTIONS, ImagePdfOptions } from '../models/image-pdf-options';
import { PAGE_SIZES_PT, PX_TO_PT, computePageLayout, pdfDrawOrigin, previewGeometry, rotateBy } from './page-layout';

const options = (overrides: Partial<ImagePdfOptions> = {}): ImagePdfOptions => ({
  ...DEFAULT_IMAGE_PDF_OPTIONS,
  ...overrides,
});

const [A4_SHORT, A4_LONG] = PAGE_SIZES_PT.a4;

describe('computePageLayout', () => {
  it('fits a landscape image on an automatically rotated A4 page', () => {
    const layout = computePageLayout({ width: 4000, height: 3000 }, 0, options({ margin: 'none' }));

    expect(layout.pageWidth).toBe(A4_LONG);
    expect(layout.pageHeight).toBe(A4_SHORT);
    expect(layout.imageWidth / layout.imageHeight).toBeCloseTo(4 / 3);
    expect(layout.imageWidth).toBeLessThanOrEqual(layout.contentWidth + 1e-6);
    expect(layout.imageHeight).toBeLessThanOrEqual(layout.contentHeight + 1e-6);
    expect(layout.clip).toBe(false);
  });

  it('treats a quarter-turned image as portrait', () => {
    const layout = computePageLayout({ width: 4000, height: 3000 }, 90, options());
    expect(layout.pageWidth).toBe(A4_SHORT);
    expect(layout.pageHeight).toBe(A4_LONG);
  });

  it('respects a forced orientation', () => {
    const layout = computePageLayout({ width: 100, height: 400 }, 0, options({ orientation: 'landscape' }));
    expect(layout.pageWidth).toBe(A4_LONG);
  });

  it('applies margins to the content area', () => {
    const layout = computePageLayout({ width: 100, height: 100 }, 0, options({ margin: 'large' }));
    expect(layout.contentWidth).toBeCloseTo(layout.pageWidth - 96);
    expect(layout.contentHeight).toBeCloseTo(layout.pageHeight - 96);
  });

  it('fills the page and clips in cover mode', () => {
    const layout = computePageLayout({ width: 1000, height: 1000 }, 0, options({ fit: 'cover', margin: 'none' }));
    expect(layout.imageWidth).toBeCloseTo(A4_LONG);
    expect(layout.clip).toBe(true);
  });

  it('keeps small images at their original size without upscaling', () => {
    const layout = computePageLayout({ width: 200, height: 100 }, 0, options({ fit: 'original' }));
    expect(layout.imageWidth).toBeCloseTo(200 * PX_TO_PT);
    expect(layout.imageHeight).toBeCloseTo(100 * PX_TO_PT);
  });

  it('sizes the page to the image when asked', () => {
    const layout = computePageLayout({ width: 800, height: 600 }, 90, options({ pageSize: 'image', margin: 'small' }));
    expect(layout.pageWidth).toBeCloseTo(600 * PX_TO_PT + 48);
    expect(layout.pageHeight).toBeCloseTo(800 * PX_TO_PT + 48);
    expect(layout.clip).toBe(false);
  });
});

describe('pdfDrawOrigin', () => {
  // pdf-lib rotates counter-clockwise about the origin; rotate (u, v) by -rotation degrees.
  const rotatedCorners = (w: number, h: number, rotation: number, x: number, y: number) => {
    const rad = (-rotation * Math.PI) / 180;
    return [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ].map(([u, v]) => [x + u * Math.cos(rad) - v * Math.sin(rad), y + u * Math.sin(rad) + v * Math.cos(rad)]);
  };

  for (const rotation of [0, 90, 180, 270] as const) {
    it(`keeps a ${rotation}° image centred in the content area`, () => {
      const layout = computePageLayout({ width: 600, height: 400 }, rotation, options({ margin: 'small' }));
      const { x, y } = pdfDrawOrigin(layout);
      const corners = rotatedCorners(layout.imageWidth, layout.imageHeight, rotation, x, y);
      const xs = corners.map(([cx]) => cx);
      const ys = corners.map(([, cy]) => cy);

      const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centreY = (Math.min(...ys) + Math.max(...ys)) / 2;
      expect(centreX).toBeCloseTo(layout.pageWidth / 2);
      expect(centreY).toBeCloseTo(layout.pageHeight / 2);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(layout.margin - 1e-6);
      expect(Math.max(...ys)).toBeLessThanOrEqual(layout.pageHeight - layout.margin + 1e-6);
    });
  }
});

describe('previewGeometry', () => {
  it('expresses the layout as centred percentages', () => {
    const layout = computePageLayout({ width: 1000, height: 500 }, 0, options({ margin: 'none' }));
    const geometry = previewGeometry(layout);

    expect(geometry.content).toEqual({ left: 0, top: 0, width: 100, height: 100 });
    expect(geometry.image.width).toBeCloseTo(100);
    expect(geometry.image.left + geometry.image.width / 2).toBeCloseTo(50);
    expect(geometry.image.top + geometry.image.height / 2).toBeCloseTo(50);
  });
});

describe('rotateBy', () => {
  it('wraps in both directions', () => {
    expect(rotateBy(0, -90)).toBe(270);
    expect(rotateBy(270, 90)).toBe(0);
    expect(rotateBy(90, 90)).toBe(180);
  });
});
