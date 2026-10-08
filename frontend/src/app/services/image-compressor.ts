import { Injectable } from '@angular/core';

import { CompressFormat, ImageCompressOptions, OutputMime } from '../models/compression-options';
import { sniffImageFormat } from './image-inspection';

export interface CompressedImage {
  blob: Blob;
  mime: OutputMime;
  width: number;
  height: number;
  /** No smaller version was possible, so the original file is returned unchanged. */
  keptOriginal: boolean;
  /** Target-size mode only: whether the result fits the target. */
  metTarget: boolean | null;
  /** WebP was requested but this browser can't encode it, so another format was used. */
  usedFallback: boolean;
}

export class ImageCompressionError extends Error {
  constructor(readonly fileName: string) {
    super(`"${fileName}" couldn't be opened as a JPG, PNG or WebP image.`);
    this.name = 'ImageCompressionError';
  }
}

type Encode = (scale: number, quality: number) => Promise<Blob>;

const MIN_QUALITY = 0.1;
const MAX_QUALITY = 0.95;
const SEARCH_STEPS = 6;
const MIN_SIDE_PX = 64;

/**
 * Find the best-looking encoding that fits `targetBytes`: the highest quality at the
 * current size, shrinking the dimensions only when even the lowest quality is too big.
 */
export async function fitToSize(
  encode: Encode,
  targetBytes: number,
  initialScale: number,
  longestSide: number,
): Promise<{ blob: Blob; scale: number; met: boolean }> {
  let scale = initialScale;
  let smallest: { blob: Blob; scale: number } | null = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const best = await encode(scale, MAX_QUALITY);
    if (best.size <= targetBytes) return { blob: best, scale, met: true };

    const worst = await encode(scale, MIN_QUALITY);
    if (worst.size <= targetBytes) {
      let fits = worst;
      let lo = MIN_QUALITY;
      let hi = MAX_QUALITY;
      for (let step = 0; step < SEARCH_STEPS; step++) {
        const mid = (lo + hi) / 2;
        const candidate = await encode(scale, mid);
        if (candidate.size <= targetBytes) {
          fits = candidate;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return { blob: fits, scale, met: true };
    }

    if (!smallest || worst.size < smallest.blob.size) smallest = { blob: worst, scale };
    // File size grows roughly with pixel count, so shrink both sides by the square root.
    const nextScale = scale * Math.max(0.5, Math.min(0.9, Math.sqrt(targetBytes / worst.size)));
    if (longestSide * nextScale < MIN_SIDE_PX) break;
    scale = nextScale;
  }
  return { blob: smallest!.blob, scale: smallest!.scale, met: false };
}

/** Re-encodes images in the browser with a canvas. Metadata such as EXIF/GPS is not carried over. */
@Injectable({ providedIn: 'root' })
export class ImageCompressor {
  private webpSupported?: Promise<boolean>;

  async compress(file: File, options: ImageCompressOptions): Promise<CompressedImage> {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const source = sniffImageFormat(header);
    let bitmap: ImageBitmap;
    try {
      if (!source) throw new Error('Unsupported format');
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new ImageCompressionError(file.name);
    }

    try {
      const transparent = source !== 'jpeg' && hasTransparency(bitmap);
      let mime = chooseMime(options.format, source!, transparent);
      let usedFallback = false;
      if (mime === 'image/webp' && !(await this.canEncodeWebp())) {
        mime = transparent ? 'image/png' : 'image/jpeg';
        usedFallback = true;
      }

      const longestSide = Math.max(bitmap.width, bitmap.height);
      const initialScale = options.maxDimension ? Math.min(1, options.maxDimension / longestSide) : 1;
      const encode: Encode = (scale, quality) => encodeBitmap(bitmap, scale, mime, quality);

      let blob: Blob;
      let scale = initialScale;
      let metTarget: boolean | null = null;
      if (options.targetBytes !== null && mime !== 'image/png') {
        ({ blob, scale, met: metTarget } = await fitToSize(encode, options.targetBytes, initialScale, longestSide));
      } else {
        blob = await encode(scale, options.quality);
        if (options.targetBytes !== null) {
          // PNG is lossless: only smaller dimensions reduce its size.
          ({ blob, scale, met: metTarget } = await fitToSize((s) => encode(s, 1), options.targetBytes, scale, longestSide));
        }
      }

      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      // Return the original when re-encoding didn't help, unless the user explicitly asked
      // for a different format (then they want the conversion even if it isn't smaller).
      const sameFormat = mime === `image/${source}`;
      if (blob.size >= file.size && scale === 1 && (sameFormat || options.format === 'auto')) {
        const originalMime = `image/${source}` as OutputMime;
        const fits = options.targetBytes === null ? null : file.size <= options.targetBytes;
        return { blob: file, mime: originalMime, width, height, keptOriginal: true, metTarget: fits, usedFallback };
      }
      return { blob, mime, width, height, keptOriginal: false, metTarget, usedFallback };
    } finally {
      bitmap.close();
    }
  }

  private canEncodeWebp(): Promise<boolean> {
    this.webpSupported ??= new Promise<boolean>((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      // Browsers that can't encode WebP silently fall back to PNG.
      canvas.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp');
    });
    return this.webpSupported;
  }
}

export function chooseMime(format: CompressFormat, source: 'jpeg' | 'png' | 'webp', transparent: boolean): OutputMime {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
      return 'image/png';
    default:
      // Keep lossy formats as they are; turn PNGs into a lossy format that suits their content.
      if (source === 'jpeg') return 'image/jpeg';
      if (source === 'webp') return 'image/webp';
      return transparent ? 'image/webp' : 'image/jpeg';
  }
}

async function encodeBitmap(bitmap: ImageBitmap, scale: number, mime: OutputMime, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    if (mime === 'image/jpeg') {
      // JPEG has no transparency; flatten onto white rather than black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) throw new Error('Canvas encoding failed');
    return blob;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

/** Checks a downscaled copy for any pixel that isn't fully opaque. */
function hasTransparency(bitmap: ImageBitmap): boolean {
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return true; // assume transparency rather than risk flattening it
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}
