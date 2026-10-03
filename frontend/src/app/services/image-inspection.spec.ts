import { orientationTransform, readJpegOrientation, sniffImageFormat } from './image-inspection';

/** A minimal JPEG prefix: SOI + APP1/Exif with one IFD0 entry for orientation. */
function jpegWithOrientation(orientation: number, littleEndian = false): Uint8Array {
  const tiff = new DataView(new ArrayBuffer(26));
  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  tiff.setUint16(2, 42, littleEndian);
  tiff.setUint32(4, 8, littleEndian); // IFD0 offset
  tiff.setUint16(8, 1, littleEndian); // one entry
  tiff.setUint16(10, 0x0112, littleEndian); // Orientation tag
  tiff.setUint16(12, 3, littleEndian); // SHORT
  tiff.setUint32(14, 1, littleEndian); // count
  tiff.setUint16(18, orientation, littleEndian);

  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
  const segmentLength = 2 + exifHeader.length + tiff.byteLength;
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff,
    ...exifHeader,
    ...new Uint8Array(tiff.buffer),
    0xff, 0xda, 0, 2, // SOS
  ]);
}

describe('sniffImageFormat', () => {
  it('recognises formats by their signatures', () => {
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniffImageFormat(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
  });

  it('rejects anything else', () => {
    expect(sniffImageFormat(new TextEncoder().encode('%PDF-1.7'))).toBeNull();
    expect(sniffImageFormat(new Uint8Array([]))).toBeNull();
  });
});

describe('readJpegOrientation', () => {
  it('reads big- and little-endian EXIF', () => {
    expect(readJpegOrientation(jpegWithOrientation(6))).toBe(6);
    expect(readJpegOrientation(jpegWithOrientation(8, true))).toBe(8);
  });

  it('defaults to 1 without EXIF or with invalid data', () => {
    expect(readJpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(1);
    expect(readJpegOrientation(jpegWithOrientation(42))).toBe(1);
    expect(readJpegOrientation(jpegWithOrientation(6).subarray(0, 20))).toBe(1);
  });
});

describe('orientationTransform', () => {
  it('maps rotations and flags mirrored orientations', () => {
    expect(orientationTransform(1)).toEqual({ rotation: 0, mirrored: false });
    expect(orientationTransform(6)).toEqual({ rotation: 90, mirrored: false });
    expect(orientationTransform(3)).toEqual({ rotation: 180, mirrored: false });
    expect(orientationTransform(8)).toEqual({ rotation: 270, mirrored: false });
    expect(orientationTransform(5).mirrored).toBe(true);
  });
});
