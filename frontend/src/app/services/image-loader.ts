import { Injectable } from '@angular/core';

import { Rotation } from '../models/image-pdf-options';
import { ImageFormat, sniffImageFormat } from './image-inspection';

export interface ImageItem {
  id: number;
  file: File;
  format: ImageFormat;
  /** Object URL for previews; revoke with `ImageLoader.release`. */
  previewUrl: string;
  /** Pixel size as displayed (EXIF orientation applied). */
  width: number;
  height: number;
  /** Clockwise rotation chosen by the user. */
  rotation: Rotation;
}

export class UnreadableImageError extends Error {
  constructor(readonly fileName: string) {
    super(`"${fileName}" couldn't be opened as a JPG, PNG or WebP image.`);
    this.name = 'UnreadableImageError';
  }
}

/** Reads user-selected images locally: verifies the format, measures them, makes previews. */
@Injectable({ providedIn: 'root' })
export class ImageLoader {
  private nextId = 1;

  async load(file: File): Promise<ImageItem> {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const format = sniffImageFormat(header);
    if (!format) {
      throw new UnreadableImageError(file.name);
    }

    let width: number;
    let height: number;
    try {
      // Decoding also proves the browser can actually read the file.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      ({ width, height } = bitmap);
      bitmap.close();
    } catch {
      throw new UnreadableImageError(file.name);
    }

    return {
      id: this.nextId++,
      file,
      format,
      previewUrl: URL.createObjectURL(file),
      width,
      height,
      rotation: 0,
    };
  }

  release(items: readonly ImageItem[]): void {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}
