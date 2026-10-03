export type PageSizeOption = 'a4' | 'letter' | 'legal' | 'image';
export type OrientationOption = 'auto' | 'portrait' | 'landscape';
export type ImageFitOption = 'contain' | 'cover' | 'original';
export type MarginOption = 'none' | 'small' | 'large';
/** Clockwise rotation in degrees. */
export type Rotation = 0 | 90 | 180 | 270;

export interface ImagePdfOptions {
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  fit: ImageFitOption;
  margin: MarginOption;
}

export const DEFAULT_IMAGE_PDF_OPTIONS: ImagePdfOptions = {
  pageSize: 'a4',
  orientation: 'auto',
  fit: 'contain',
  margin: 'small',
};

export interface Choice<T> {
  value: T;
  label: string;
}

export const PAGE_SIZE_CHOICES: readonly Choice<PageSizeOption>[] = [
  { value: 'a4', label: 'A4 (210 × 297 mm)' },
  { value: 'letter', label: 'US Letter (8.5 × 11 in)' },
  { value: 'legal', label: 'US Legal (8.5 × 14 in)' },
  { value: 'image', label: 'Same as image' },
];

export const ORIENTATION_CHOICES: readonly Choice<OrientationOption>[] = [
  { value: 'auto', label: 'Automatic (match each image)' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

export const FIT_CHOICES: readonly Choice<ImageFitOption>[] = [
  { value: 'contain', label: 'Fit to page' },
  { value: 'cover', label: 'Fill page (crop edges)' },
  { value: 'original', label: 'Original size (shrink if too big)' },
];

export const MARGIN_CHOICES: readonly Choice<MarginOption>[] = [
  { value: 'none', label: 'No margin' },
  { value: 'small', label: 'Small margin' },
  { value: 'large', label: 'Large margin' },
];
