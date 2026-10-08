import { Choice } from './image-pdf-options';

// ---------- Images ----------

export type CompressFormat = 'auto' | 'jpeg' | 'webp' | 'png';
export type OutputMime = 'image/jpeg' | 'image/webp' | 'image/png';
export type SizeUnit = 'KB' | 'MB';

export interface ImageCompressOptions {
  format: CompressFormat;
  /** Longest side in pixels; null keeps the original dimensions. */
  maxDimension: number | null;
  /** Encoder quality, 0.1–1. Used when there is no target size. */
  quality: number;
  /** Aim for at most this many bytes per image, or null to use `quality`. */
  targetBytes: number | null;
}

export const COMPRESS_FORMAT_CHOICES: readonly Choice<CompressFormat>[] = [
  { value: 'auto', label: 'Automatic (recommended)' },
  { value: 'jpeg', label: 'JPEG — smallest for photos' },
  { value: 'webp', label: 'WebP — small, keeps transparency' },
  { value: 'png', label: 'PNG — lossless (resize only)' },
];

export const MAX_DIMENSION_CHOICES: readonly Choice<number | null>[] = [
  { value: null, label: 'Keep original size' },
  { value: 3840, label: 'Up to 3840 px (4K)' },
  { value: 2560, label: 'Up to 2560 px' },
  { value: 1920, label: 'Up to 1920 px (Full HD)' },
  { value: 1280, label: 'Up to 1280 px' },
  { value: 800, label: 'Up to 800 px' },
];

export const MIME_EXTENSION: Record<OutputMime, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
};

// ---------- PDFs ----------

export type PdfCompressionLevel = 'light' | 'recommended' | 'strong' | 'maximum';

export interface PdfLevelSettings {
  /** Longest side for embedded images, in pixels. */
  maxImageSide: number;
  /** JPEG quality, 0–1. */
  quality: number;
  /** Render whole pages as images instead of re-encoding embedded images. */
  rasterize: boolean;
  /** Resolution used when rasterizing pages. */
  rasterDpi: number;
}

export const PDF_LEVELS: Record<PdfCompressionLevel, PdfLevelSettings> = {
  light: { maxImageSide: 3000, quality: 0.82, rasterize: false, rasterDpi: 0 },
  recommended: { maxImageSide: 2000, quality: 0.7, rasterize: false, rasterDpi: 0 },
  strong: { maxImageSide: 1400, quality: 0.55, rasterize: false, rasterDpi: 0 },
  maximum: { maxImageSide: 0, quality: 0.6, rasterize: true, rasterDpi: 110 },
};

export interface LevelChoice extends Choice<PdfCompressionLevel> {
  description: string;
}

export const PDF_LEVEL_CHOICES: readonly LevelChoice[] = [
  { value: 'light', label: 'Light', description: 'Best quality, smaller savings.' },
  { value: 'recommended', label: 'Recommended', description: 'Good quality and good savings for most files.' },
  { value: 'strong', label: 'Strong', description: 'Smaller files; photos and scans look softer.' },
  {
    value: 'maximum',
    label: 'Maximum',
    description: 'Turns every page into an image. Smallest files, but text can no longer be selected or searched.',
  },
];
