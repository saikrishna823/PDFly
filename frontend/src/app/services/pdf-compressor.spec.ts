import { PDFContext, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

import { jpegSize, planImage } from './pdf-compressor';

const BIG = new Uint8Array(20 * 1024);

async function makeContext(): Promise<PDFContext> {
  return (await PDFDocument.create()).context;
}

function image(context: PDFContext, entries: Record<string, unknown>, contents = BIG): PDFRawStream {
  // pdf-lib's literal types don't model nested literals well; the runtime handles them.
  const literal: Parameters<PDFContext['obj']>[0] = { Type: 'XObject', Subtype: 'Image', Width: 400, Height: 300, BitsPerComponent: 8, ...entries } as never;
  const dict = context.obj(literal) as unknown as PDFDict;
  return PDFRawStream.of(dict, contents);
}

describe('planImage', () => {
  it('accepts RGB and grayscale JPEG and Flate images', async () => {
    const context = await makeContext();
    expect(planImage(image(context, { Filter: 'DCTDecode', ColorSpace: 'DeviceRGB' }), context)).toMatchObject({
      source: 'jpeg',
      components: 3,
      width: 400,
      height: 300,
    });
    const gray = planImage(image(context, { Filter: 'FlateDecode', ColorSpace: 'DeviceGray' }), context);
    expect(gray).toMatchObject({ source: 'raw', components: 1 });
    expect(gray?.outputColorSpace).toBe(PDFName.of('DeviceRGB'));
  });

  it('keeps an RGB ICC profile and reads its component count', async () => {
    const context = await makeContext();
    const profile = context.register(context.stream(new Uint8Array(8), { N: 3 }));
    const colorSpace = context.obj(['ICCBased', profile]);
    const plan = planImage(image(context, { Filter: 'DCTDecode', ColorSpace: colorSpace }), context);
    expect(plan?.components).toBe(3);
    expect(plan?.outputColorSpace).toBe(colorSpace);
  });

  it.each([
    ['CMYK', { Filter: 'DCTDecode', ColorSpace: 'DeviceCMYK' }],
    ['16-bit', { Filter: 'FlateDecode', ColorSpace: 'DeviceRGB', BitsPerComponent: 16 }],
    ['JPEG 2000', { Filter: 'JPXDecode', ColorSpace: 'DeviceRGB' }],
    ['PNG predictor', { Filter: 'FlateDecode', ColorSpace: 'DeviceRGB', DecodeParms: { Predictor: 15 } }],
    ['Decode array', { Filter: 'DCTDecode', ColorSpace: 'DeviceRGB', Decode: [1, 0, 1, 0, 1, 0] }],
    ['colour-key mask', { Filter: 'DCTDecode', ColorSpace: 'DeviceRGB', Mask: [0, 10, 0, 10, 0, 10] }],
    ['stencil mask', { ImageMask: true, ColorSpace: 'DeviceGray' }],
  ])('skips %s images', async (_label, entries) => {
    const context = await makeContext();
    expect(planImage(image(context, entries), context)).toBeNull();
  });

  it('skips tiny images and non-images', async () => {
    const context = await makeContext();
    expect(planImage(image(context, { Filter: 'DCTDecode', ColorSpace: 'DeviceRGB' }, new Uint8Array(100)), context)).toBeNull();
    const form = PDFRawStream.of(context.obj({ Subtype: 'Form' }) as PDFDict, BIG);
    expect(planImage(form, context)).toBeNull();
  });
});

describe('jpegSize', () => {
  it('reads dimensions from the frame header', () => {
    // SOI, APP0 (len 4), SOF0 with height 300 and width 400
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, 0x03]);
    expect(jpegSize(bytes)).toEqual({ width: 400, height: 300 });
    expect(jpegSize(new Uint8Array([0x00, 0x01]))).toBeNull();
  });
});
