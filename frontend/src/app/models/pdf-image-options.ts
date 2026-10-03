import { Choice } from './image-pdf-options';

export type OutputFormat = 'png' | 'jpeg';
export type Resolution = 72 | 150 | 300;

export interface PdfImageOptions {
  format: OutputFormat;
  dpi: Resolution;
  /** JPEG quality, 50–100. Ignored for PNG. */
  quality: number;
}

export const DEFAULT_PDF_IMAGE_OPTIONS: PdfImageOptions = {
  format: 'png',
  dpi: 150,
  quality: 85,
};

export const FORMAT_CHOICES: readonly Choice<OutputFormat>[] = [
  { value: 'png', label: 'PNG — sharp text, larger files' },
  { value: 'jpeg', label: 'JPEG — smaller files, best for photos' },
];

export const RESOLUTION_CHOICES: readonly Choice<Resolution>[] = [
  { value: 72, label: '72 DPI — screen' },
  { value: 150, label: '150 DPI — standard' },
  { value: 300, label: '300 DPI — print quality' },
];

export const IMAGE_MIME: Record<OutputFormat, string> = { png: 'image/png', jpeg: 'image/jpeg' };
export const IMAGE_EXTENSION: Record<OutputFormat, string> = { png: 'png', jpeg: 'jpg' };
