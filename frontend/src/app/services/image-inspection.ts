import { Rotation } from '../models/image-pdf-options';

export type ImageFormat = 'jpeg' | 'png' | 'webp';

/** Identify an image by its leading bytes rather than trusting the file name or MIME type. */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  ) {
    return 'png';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'webp';
  }
  return null;
}

/**
 * Read the EXIF orientation tag (1–8) from a JPEG. Returns 1 ("normal") when absent.
 * Phones store photos sideways and rely on this tag, which PDF viewers ignore.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      return 1;
    }
    const marker = view.getUint8(offset + 1);
    const segmentLength = view.getUint16(offset + 2);
    if (marker === 0xda || marker === 0xd9) {
      return 1; // start of image data / end of image: no EXIF before it
    }
    if (marker === 0xe1 && ascii(bytes, offset + 4, 6) === 'Exif\0\0') {
      return readTiffOrientation(view, offset + 10);
    }
    offset += 2 + segmentLength;
  }
  return 1;
}

function readTiffOrientation(view: DataView, tiffStart: number): number {
  if (tiffStart + 8 > view.byteLength) return 1;
  const littleEndian = view.getUint16(tiffStart) === 0x4949;
  const firstIfd = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
  if (firstIfd + 2 > view.byteLength) return 1;

  const entries = view.getUint16(firstIfd, littleEndian);
  for (let i = 0; i < entries; i++) {
    const entry = firstIfd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return 1;
    if (view.getUint16(entry, littleEndian) === 0x0112) {
      const value = view.getUint16(entry + 8, littleEndian);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/** Map an EXIF orientation to a clockwise rotation; mirrored orientations need re-rendering. */
export function orientationTransform(orientation: number): { rotation: Rotation; mirrored: boolean } {
  switch (orientation) {
    case 3:
      return { rotation: 180, mirrored: false };
    case 6:
      return { rotation: 90, mirrored: false };
    case 8:
      return { rotation: 270, mirrored: false };
    case 2:
    case 4:
    case 5:
    case 7:
      return { rotation: 0, mirrored: true };
    default:
      return { rotation: 0, mirrored: false };
  }
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}
