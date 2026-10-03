import { Injectable } from '@angular/core';
import {
  PDFDocument,
  PDFImage,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
} from 'pdf-lib';

import { ImagePdfOptions, Rotation } from '../models/image-pdf-options';
import { orientationTransform, readJpegOrientation, sniffImageFormat } from './image-inspection';
import { computePageLayout, pdfDrawOrigin } from './page-layout';

export interface ImagePdfSource {
  file: File;
  /** Extra clockwise rotation chosen by the user. */
  rotation: Rotation;
}

export class ImageConversionError extends Error {
  constructor(readonly fileName: string) {
    super(`We couldn't read "${fileName}". It may be damaged or in an unsupported format.`);
    this.name = 'ImageConversionError';
  }
}

const RASTER_JPEG_QUALITY = 0.92;

/**
 * Builds PDFs from images entirely in the browser.
 *
 * JPEG and PNG files are embedded as-is (no quality loss). WebP files and mirrored JPEGs
 * are re-rendered through a canvas first, because PDF has no native WebP support.
 */
@Injectable({ providedIn: 'root' })
export class ImagePdfConverter {
  async createPdf(
    sources: readonly ImagePdfSource[],
    options: ImagePdfOptions,
    title: string,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<Blob> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(title);
    pdf.setCreator('PDFly');
    pdf.setProducer('PDFly (pdf-lib)');

    for (const [index, source] of sources.entries()) {
      onProgress?.(index, sources.length);
      // Yield so the progress indicator can repaint between images.
      await new Promise((resolve) => setTimeout(resolve));

      const { image, baseRotation } = await this.embed(pdf, source.file);
      const rotation = ((baseRotation + source.rotation) % 360) as Rotation;
      const layout = computePageLayout({ width: image.width, height: image.height }, rotation, options);
      const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);

      if (layout.clip) {
        page.pushOperators(
          pushGraphicsState(),
          rectangle(layout.margin, layout.margin, layout.contentWidth, layout.contentHeight),
          clip(),
          endPath(),
        );
      }
      page.drawImage(image, {
        ...pdfDrawOrigin(layout),
        width: layout.imageWidth,
        height: layout.imageHeight,
        rotate: degrees(-rotation),
      });
      if (layout.clip) {
        page.pushOperators(popGraphicsState());
      }
    }

    onProgress?.(sources.length, sources.length);
    const bytes = await pdf.save();
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  }

  private async embed(pdf: PDFDocument, file: File): Promise<{ image: PDFImage; baseRotation: Rotation }> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = sniffImageFormat(bytes);

    try {
      if (format === 'jpeg') {
        const { rotation, mirrored } = orientationTransform(readJpegOrientation(bytes));
        if (!mirrored) {
          // Keep the original JPEG data and express EXIF orientation as page rotation.
          return { image: await pdf.embedJpg(bytes), baseRotation: rotation };
        }
      } else if (format === 'png') {
        return { image: await pdf.embedPng(bytes), baseRotation: 0 };
      }
    } catch {
      // Fall through to the canvas path, which tolerates more encoder quirks.
    }

    try {
      return { image: await pdf.embedJpg(await rasterizeToJpeg(file)), baseRotation: 0 };
    } catch {
      throw new ImageConversionError(file.name);
    }
  }
}

/** Decode with the browser (applying EXIF orientation) and re-encode as JPEG on white. */
async function rasterizeToJpeg(file: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', RASTER_JPEG_QUALITY),
    );
    if (!blob) {
      throw new Error('Canvas encoding failed');
    }
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
