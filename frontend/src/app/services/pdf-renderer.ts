import { Injectable } from '@angular/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { IMAGE_MIME, PdfImageOptions } from '../models/pdf-image-options';

type PdfJs = typeof import('pdfjs-dist');

/** Where angular.json copies pdf.js's worker, fonts, CMaps and decoders. */
const ASSET_DIR = 'pdfjs/';
/** Stay under Safari's canvas limit (~16.7 MP) so very large pages still render everywhere. */
const MAX_CANVAS_PIXELS = 16_000_000;
const PDF_POINTS_PER_INCH = 72;

export type PdfOpenErrorKind = 'password' | 'invalid' | 'unknown';

export class PdfOpenError extends Error {
  constructor(readonly kind: PdfOpenErrorKind) {
    super(
      kind === 'password'
        ? "This PDF is password protected, so it can't be converted. Remove the password in your PDF app, then try again."
        : kind === 'invalid'
          ? "We couldn't read this PDF. It may be damaged or not actually a PDF file."
          : "We couldn't open this PDF. Please try again or use a different file.",
    );
    this.name = 'PdfOpenError';
  }
}

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
  /** True when the page was rendered below the requested DPI to fit browser canvas limits. */
  downscaled: boolean;
}

/** An open PDF. Call `destroy()` when finished to free the worker's memory. */
export class PdfDocument {
  constructor(private readonly doc: PDFDocumentProxy) {}

  get pageCount(): number {
    return this.doc.numPages;
  }

  /** A small JPEG preview, `targetWidth` CSS pixels wide (rendered sharper on high-DPI screens). */
  async renderThumbnail(pageNumber: number, targetWidth: number): Promise<Blob> {
    const page = await this.doc.getPage(pageNumber);
    const pixelWidth = targetWidth * Math.min(window.devicePixelRatio || 1, 2);
    const scale = pixelWidth / page.getViewport({ scale: 1 }).width;
    return (await this.render(pageNumber, scale, 'image/jpeg', 0.75)).blob;
  }

  renderPage(pageNumber: number, options: PdfImageOptions): Promise<RenderedPage> {
    return this.render(pageNumber, options.dpi / PDF_POINTS_PER_INCH, IMAGE_MIME[options.format], options.quality / 100);
  }

  destroy(): void {
    void this.doc.loadingTask.destroy();
  }

  private async render(pageNumber: number, requestedScale: number, type: string, quality: number): Promise<RenderedPage> {
    const page = await this.doc.getPage(pageNumber);
    const canvas = document.createElement('canvas');
    try {
      let scale = requestedScale;
      let viewport = page.getViewport({ scale });
      const pixels = viewport.width * viewport.height;
      const downscaled = pixels > MAX_CANVAS_PIXELS;
      if (downscaled) {
        scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        viewport = page.getViewport({ scale });
      }

      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      // PDF pages are drawn on white paper; keep that for PNG too instead of transparency.
      await page.render({ canvas, viewport, background: '#ffffff' }).promise;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
      if (!blob) {
        throw new Error('Canvas encoding failed');
      }
      return { blob, width: canvas.width, height: canvas.height, downscaled };
    } finally {
      // Release the bitmap memory promptly; large canvases add up quickly.
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  }
}

/** Opens PDFs with pdf.js, entirely in the browser. pdf.js itself is loaded on first use. */
@Injectable({ providedIn: 'root' })
export class PdfRenderer {
  private pdfjs?: Promise<PdfJs>;

  async open(file: File): Promise<PdfDocument> {
    const pdfjs = await this.load();
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: assetUrl('cmaps/'),
      standardFontDataUrl: assetUrl('standard_fonts/'),
      wasmUrl: assetUrl('wasm/'),
      iccUrl: assetUrl('iccs/'),
      enableXfa: false,
    });

    try {
      return new PdfDocument(await task.promise);
    } catch (error) {
      void task.destroy();
      if (error instanceof pdfjs.PasswordException) throw new PdfOpenError('password');
      if (error instanceof pdfjs.InvalidPDFException) throw new PdfOpenError('invalid');
      console.error('pdf.js failed to open document', error);
      throw new PdfOpenError('unknown');
    }
  }

  private load(): Promise<PdfJs> {
    this.pdfjs ??= import('pdfjs-dist').then((pdfjs) => {
      // The version query stops a cached worker from an older release being paired with a newer library.
      pdfjs.GlobalWorkerOptions.workerSrc = assetUrl(`pdf.worker.min.mjs?v=${pdfjs.version}`);
      return pdfjs;
    });
    return this.pdfjs;
  }
}

function assetUrl(path: string): string {
  return new URL(ASSET_DIR + path, document.baseURI).href;
}
