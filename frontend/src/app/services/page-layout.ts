import { ImagePdfOptions, MarginOption, PageSizeOption, Rotation } from '../models/image-pdf-options';

/** PDF points (1/72 in), portrait. */
export const PAGE_SIZES_PT: Record<Exclude<PageSizeOption, 'image'>, readonly [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
};

export const MARGINS_PT: Record<MarginOption, number> = {
  none: 0,
  small: 24,
  large: 48,
};

/** Treat image pixels as CSS pixels (96 dpi) when an image is placed at its "original" size. */
export const PX_TO_PT = 72 / 96;

export interface Size {
  width: number;
  height: number;
}

/**
 * Where one image sits on one page. All lengths are PDF points. The image is always
 * centred in the content area (the page minus margins).
 */
export interface PageLayout {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  contentHeight: number;
  /** The image's drawn size *before* rotation is applied. */
  imageWidth: number;
  imageHeight: number;
  rotation: Rotation;
  /** True when the image overflows the content area and must be clipped ("fill" mode). */
  clip: boolean;
}

/**
 * Lay out an image of `size` pixels, rotated clockwise by `rotation`, on a page.
 * Shared by the PDF writer and the on-screen preview so the preview is exact.
 */
export function computePageLayout(size: Size, rotation: Rotation, options: ImagePdfOptions): PageLayout {
  const quarterTurn = rotation % 180 !== 0;
  const shownWidth = quarterTurn ? size.height : size.width;
  const shownHeight = quarterTurn ? size.width : size.height;
  const margin = MARGINS_PT[options.margin];

  let pageWidth: number;
  let pageHeight: number;
  let scale: number;

  if (options.pageSize === 'image') {
    scale = PX_TO_PT;
    pageWidth = shownWidth * scale + 2 * margin;
    pageHeight = shownHeight * scale + 2 * margin;
  } else {
    const [short, long] = PAGE_SIZES_PT[options.pageSize];
    const landscape =
      options.orientation === 'landscape' || (options.orientation === 'auto' && shownWidth > shownHeight);
    pageWidth = landscape ? long : short;
    pageHeight = landscape ? short : long;

    const fitWidth = (pageWidth - 2 * margin) / shownWidth;
    const fitHeight = (pageHeight - 2 * margin) / shownHeight;
    scale =
      options.fit === 'cover'
        ? Math.max(fitWidth, fitHeight)
        : options.fit === 'original'
          ? Math.min(PX_TO_PT, fitWidth, fitHeight)
          : Math.min(fitWidth, fitHeight);
  }

  const contentWidth = pageWidth - 2 * margin;
  const contentHeight = pageHeight - 2 * margin;
  return {
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    contentHeight,
    imageWidth: size.width * scale,
    imageHeight: size.height * scale,
    rotation,
    clip: shownWidth * scale > contentWidth + 0.01 || shownHeight * scale > contentHeight + 0.01,
  };
}

/**
 * The origin to pass to pdf-lib's `drawImage` together with `rotate: degrees(-rotation)`.
 * pdf-lib rotates counter-clockwise around the origin (bottom-left in PDF space), so the
 * origin has to move to keep the rotated image centred.
 */
export function pdfDrawOrigin(layout: PageLayout): { x: number; y: number } {
  const { imageWidth: w, imageHeight: h, rotation } = layout;
  const quarterTurn = rotation % 180 !== 0;
  const boxWidth = quarterTurn ? h : w;
  const boxHeight = quarterTurn ? w : h;
  const x = layout.margin + (layout.contentWidth - boxWidth) / 2;
  const y = layout.margin + (layout.contentHeight - boxHeight) / 2;

  switch (rotation) {
    case 90:
      return { x, y: y + w };
    case 180:
      return { x: x + w, y: y + h };
    case 270:
      return { x: x + h, y };
    default:
      return { x, y };
  }
}

export interface PreviewGeometry {
  aspectRatio: string;
  /** Content area, as percentages of the page. */
  content: { left: number; top: number; width: number; height: number };
  /** Unrotated image box, as percentages of the content area. Rotate it about its centre. */
  image: { left: number; top: number; width: number; height: number };
  rotation: Rotation;
}

export function previewGeometry(layout: PageLayout): PreviewGeometry {
  const { pageWidth, pageHeight, margin, contentWidth, contentHeight, imageWidth, imageHeight } = layout;
  return {
    aspectRatio: `${pageWidth} / ${pageHeight}`,
    content: {
      left: (margin / pageWidth) * 100,
      top: (margin / pageHeight) * 100,
      width: (contentWidth / pageWidth) * 100,
      height: (contentHeight / pageHeight) * 100,
    },
    image: {
      left: ((contentWidth - imageWidth) / 2 / contentWidth) * 100,
      top: ((contentHeight - imageHeight) / 2 / contentHeight) * 100,
      width: (imageWidth / contentWidth) * 100,
      height: (imageHeight / contentHeight) * 100,
    },
    rotation: layout.rotation,
  };
}

export function rotateBy(rotation: Rotation, delta: 90 | -90): Rotation {
  return (((rotation + delta) % 360) + 360) % 360 as Rotation;
}
