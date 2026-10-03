import { PDFDocument } from 'pdf-lib';

import { DEFAULT_IMAGE_PDF_OPTIONS, ImagePdfOptions } from '../models/image-pdf-options';
import { ImagePdfConverter } from './image-pdf-converter';
import { PAGE_SIZES_PT, PX_TO_PT } from './page-layout';

// 40×20 px fixtures (landscape).
const PNG_40x20 =
  'iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAIklEQVR4nGM4MUCAYdTiUYtHLR61eNTiUYtHLR61eORYDABe1FNqhH8OKAAAAABJRU5ErkJggg==';
const JPEG_40x20 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wgARCAAUACgDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGkAAAAAAAD/8QAFBABAAAAAAAAAAAAAAAAAAAAMP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAMP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAMP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAw/9oACAEBAAE/EH//2Q==';

const bytesOf = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Insert an EXIF APP1 segment carrying `orientation` right after the JPEG SOI marker. */
function withExifOrientation(jpeg: Uint8Array, orientation: number): Uint8Array {
  const app1 = [
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF header, big-endian
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation
    0x00, 0x00, 0x00, 0x00, // next IFD
  ];
  return new Uint8Array([...jpeg.subarray(0, 2), ...app1, ...jpeg.subarray(2)]);
}

const fileFrom = (bytes: Uint8Array, name: string, type: string) => new File([bytes as Uint8Array<ArrayBuffer>], name, { type });

async function convert(sources: { file: File; rotation?: 0 | 90 | 180 | 270 }[], overrides: Partial<ImagePdfOptions> = {}) {
  const blob = await new ImagePdfConverter().createPdf(
    sources.map((s) => ({ file: s.file, rotation: s.rotation ?? 0 })),
    { ...DEFAULT_IMAGE_PDF_OPTIONS, ...overrides },
    'Test',
  );
  expect(blob.type).toBe('application/pdf');
  return PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
}

const [A4_SHORT, A4_LONG] = PAGE_SIZES_PT.a4;

describe('ImagePdfConverter', () => {
  it('creates one page per image, in order, with metadata', async () => {
    const pdf = await convert([
      { file: fileFrom(bytesOf(PNG_40x20), 'a.png', 'image/png') },
      { file: fileFrom(bytesOf(JPEG_40x20), 'b.jpg', 'image/jpeg'), rotation: 90 },
    ]);

    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe('Test');
    // Auto orientation: landscape image → landscape page; rotated image → portrait page.
    expect(pdf.getPage(0).getSize()).toEqual({ width: A4_LONG, height: A4_SHORT });
    expect(pdf.getPage(1).getSize()).toEqual({ width: A4_SHORT, height: A4_LONG });
  });

  it('honours EXIF orientation on JPEGs without re-encoding them', async () => {
    const rotated = withExifOrientation(bytesOf(JPEG_40x20), 6);
    const pdf = await convert([{ file: fileFrom(rotated, 'phone.jpg', 'image/jpeg') }], { pageSize: 'image', margin: 'none' });

    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(20 * PX_TO_PT);
    expect(height).toBeCloseTo(40 * PX_TO_PT);
  });

  it('supports fill mode (clipped) without errors', async () => {
    const pdf = await convert([{ file: fileFrom(bytesOf(PNG_40x20), 'a.png', 'image/png') }], {
      fit: 'cover',
      orientation: 'portrait',
    });
    expect(pdf.getPage(0).getSize()).toEqual({ width: A4_SHORT, height: A4_LONG });
  });
});
