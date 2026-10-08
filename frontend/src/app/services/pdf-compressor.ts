import { Injectable, inject } from '@angular/core';
import {
  EncryptedPDFError,
  PDFArray,
  PDFBool,
  PDFContext,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from 'pdf-lib';

import { PDF_LEVELS, PdfCompressionLevel, PdfLevelSettings } from '../models/compression-options';
import { PdfOpenError, PdfRenderer } from './pdf-renderer';

export interface PdfCompressionResult {
  blob: Blob;
  /** Embedded images that were re-encoded (image mode). */
  imagesRecompressed: number;
  /** Pages were turned into images (maximum mode). */
  rasterized: boolean;
  /** Nothing smaller could be produced; `blob` is the original file. */
  keptOriginal: boolean;
}

export type CompressionProgress = (completed: number, total: number) => void;

/** How an embedded image can be re-encoded, or why it is left alone. */
export interface ImagePlan {
  source: 'jpeg' | 'raw';
  width: number;
  height: number;
  components: 1 | 3;
  /** Colour space for the re-encoded (always RGB JPEG) image. */
  outputColorSpace: PDFObject;
}

/** Images smaller than this aren't worth re-encoding. */
const MIN_IMAGE_BYTES = 16 * 1024;
/** Keep a re-encoded image only if it saves at least this fraction. */
const MIN_SAVING = 0.1;

const REPLACED_KEYS = new Set(['/Filter', '/DecodeParms', '/Length', '/Width', '/Height', '/ColorSpace', '/BitsPerComponent']);

/**
 * Decide whether an image XObject can be safely re-encoded as an RGB JPEG.
 * Anything unusual (CMYK, indexed colours, masks, predictors, 16-bit, JPEG 2000…) is skipped,
 * so the worst case is "no change" rather than a damaged document.
 */
export function planImage(stream: PDFRawStream, context: PDFContext): ImagePlan | null {
  const dict = stream.dict;
  if (dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) return null;
  if (stream.contents.length < MIN_IMAGE_BYTES) return null;
  if (dict.lookup(PDFName.of('ImageMask')) === PDFBool.True) return null;
  if (dict.has(PDFName.of('Decode'))) return null;
  if (dict.lookup(PDFName.of('Mask')) instanceof PDFArray) return null; // colour-key masks depend on exact pixel values

  const bits = dict.lookup(PDFName.of('BitsPerComponent'));
  if (!(bits instanceof PDFNumber) || bits.asNumber() !== 8) return null;
  const width = dict.lookup(PDFName.of('Width'));
  const height = dict.lookup(PDFName.of('Height'));
  if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) return null;

  let filter = dict.lookup(PDFName.of('Filter'));
  if (filter instanceof PDFArray) {
    if (filter.size() !== 1) return null;
    filter = filter.lookup(0);
  }
  let source: ImagePlan['source'];
  if (filter === PDFName.of('DCTDecode')) {
    source = 'jpeg';
  } else if (filter === undefined || filter === PDFName.of('FlateDecode')) {
    if (hasPredictor(dict)) return null;
    source = 'raw';
  } else {
    return null;
  }

  const colorSpace = dict.get(PDFName.of('ColorSpace'));
  const components = componentCount(colorSpace ? context.lookup(colorSpace) : undefined, context);
  if (!components) return null;

  return {
    source,
    width: width.asNumber(),
    height: height.asNumber(),
    components,
    outputColorSpace: components === 3 && colorSpace ? colorSpace : PDFName.of('DeviceRGB'),
  };
}

function hasPredictor(dict: PDFDict): boolean {
  let params = dict.lookup(PDFName.of('DecodeParms'));
  if (params instanceof PDFArray) params = params.lookup(0);
  if (!(params instanceof PDFDict)) return false;
  const predictor = params.lookup(PDFName.of('Predictor'));
  return predictor instanceof PDFNumber && predictor.asNumber() > 1;
}

function componentCount(colorSpace: PDFObject | undefined, context: PDFContext): 1 | 3 | null {
  if (colorSpace === PDFName.of('DeviceRGB')) return 3;
  if (colorSpace === PDFName.of('DeviceGray')) return 1;
  if (colorSpace instanceof PDFArray && colorSpace.lookup(0) === PDFName.of('ICCBased')) {
    const profile = context.lookup(colorSpace.get(1));
    const n = profile instanceof PDFStream ? profile.dict.lookup(PDFName.of('N')) : undefined;
    if (n instanceof PDFNumber && (n.asNumber() === 1 || n.asNumber() === 3)) return n.asNumber() as 1 | 3;
  }
  return null; // CMYK, Indexed, Lab, Separation, DeviceN…
}

/** Shrinks PDFs in the browser. Nothing is uploaded. */
@Injectable({ providedIn: 'root' })
export class PdfCompressor {
  private readonly renderer = inject(PdfRenderer);

  async compress(file: File, level: PdfCompressionLevel, onProgress?: CompressionProgress): Promise<PdfCompressionResult> {
    const settings = PDF_LEVELS[level];
    const result = settings.rasterize
      ? await this.rasterize(file, settings, onProgress)
      : await this.recompressImages(file, settings, onProgress);

    if (result.blob.size >= file.size) {
      return { ...result, blob: file, keptOriginal: true };
    }
    return result;
  }

  /** Re-encode large embedded images; text, vectors and links are untouched. */
  private async recompressImages(
    file: File,
    settings: PdfLevelSettings,
    onProgress?: CompressionProgress,
  ): Promise<PdfCompressionResult> {
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { updateMetadata: false });
    } catch (error) {
      throw new PdfOpenError(error instanceof EncryptedPDFError ? 'password' : 'invalid');
    }

    const { context } = pdf;
    const candidates = context
      .enumerateIndirectObjects()
      .flatMap(([ref, object]) => {
        if (!(object instanceof PDFRawStream)) return [];
        const plan = planImage(object, context);
        return plan ? [{ ref, stream: object, plan }] : [];
      });

    let recompressed = 0;
    for (const [index, { ref, stream, plan }] of candidates.entries()) {
      onProgress?.(index, candidates.length);
      await new Promise((resolve) => setTimeout(resolve)); // let the progress bar repaint
      try {
        const jpeg = await reencode(stream, plan, settings);
        if (jpeg && jpeg.length < stream.contents.length * (1 - MIN_SAVING)) {
          context.assign(ref, replacementStream(context, stream, plan, jpeg));
          recompressed++;
        }
      } catch (error) {
        // A single unusual image shouldn't fail the whole document.
        console.warn('Skipped an image that could not be re-encoded', error);
      }
    }
    onProgress?.(candidates.length, candidates.length);

    const bytes = await pdf.save({ useObjectStreams: true });
    return {
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      imagesRecompressed: recompressed,
      rasterized: false,
      keptOriginal: false,
    };
  }

  /** Render every page to a JPEG and rebuild the PDF from those images. */
  private async rasterize(file: File, settings: PdfLevelSettings, onProgress?: CompressionProgress): Promise<PdfCompressionResult> {
    const source = await this.renderer.open(file);
    try {
      const output = await PDFDocument.create();
      for (let pageNumber = 1; pageNumber <= source.pageCount; pageNumber++) {
        onProgress?.(pageNumber - 1, source.pageCount);
        const size = await source.pageSize(pageNumber);
        const rendered = await source.renderPage(pageNumber, {
          format: 'jpeg',
          dpi: settings.rasterDpi as 72,
          quality: Math.round(settings.quality * 100),
        });
        const image = await output.embedJpg(new Uint8Array(await rendered.blob.arrayBuffer()));
        output.addPage([size.width, size.height]).drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
      }
      onProgress?.(source.pageCount, source.pageCount);
      const bytes = await output.save({ useObjectStreams: true });
      return {
        blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        imagesRecompressed: 0,
        rasterized: true,
        keptOriginal: false,
      };
    } finally {
      source.destroy();
    }
  }
}

async function reencode(stream: PDFRawStream, plan: ImagePlan, settings: PdfLevelSettings): Promise<Uint8Array | null> {
  const bitmap =
    plan.source === 'jpeg'
      ? await createImageBitmap(new Blob([stream.contents as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }), {
          // PDF viewers ignore EXIF orientation inside embedded JPEGs; so must we.
          imageOrientation: 'none',
        })
      : await createImageBitmap(rawToImageData(decodePDFRawStream(stream).decode(), plan));
  try {
    if (bitmap.width !== plan.width || bitmap.height !== plan.height) return null;
    const scale = Math.min(1, settings.maxImageSide / Math.max(plan.width, plan.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(plan.width * scale));
    canvas.height = Math.max(1, Math.round(plan.height * scale));
    try {
      const context2d = canvas.getContext('2d');
      if (!context2d) return null;
      context2d.imageSmoothingQuality = 'high';
      context2d.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', settings.quality));
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    bitmap.close();
  }
}

function rawToImageData(pixels: Uint8Array, plan: ImagePlan): ImageData {
  const { width, height, components } = plan;
  if (pixels.length < width * height * components) throw new Error('Image data is shorter than expected');
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += components) {
    const o = i * 4;
    if (components === 1) {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = pixels[j];
    } else {
      rgba[o] = pixels[j];
      rgba[o + 1] = pixels[j + 1];
      rgba[o + 2] = pixels[j + 2];
    }
    rgba[o + 3] = 255;
  }
  return new ImageData(rgba, width, height);
}

function replacementStream(context: PDFContext, original: PDFRawStream, plan: ImagePlan, jpeg: Uint8Array): PDFRawStream {
  const dict = context.obj({});
  // Keep everything else (SMask, Interpolate, Intent, Metadata, OC…) exactly as it was.
  for (const [key, value] of original.dict.entries()) {
    if (!REPLACED_KEYS.has(key.toString())) dict.set(key, value);
  }
  // The JPEG may have been downscaled, so take the dimensions from the encoded data.
  const { width, height } = jpegSize(jpeg) ?? { width: plan.width, height: plan.height };
  dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
  dict.set(PDFName.of('Width'), PDFNumber.of(width));
  dict.set(PDFName.of('Height'), PDFNumber.of(height));
  dict.set(PDFName.of('ColorSpace'), plan.outputColorSpace);
  dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
  dict.set(PDFName.of('Length'), PDFNumber.of(jpeg.length));
  return PDFRawStream.of(dict, jpeg);
}

/** Read width/height from a JPEG's start-of-frame marker. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
    }
    offset += 2 + length;
  }
  return null;
}

