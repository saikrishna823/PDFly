import { unzipSync } from 'fflate';

import { ZipBuilder } from './zip-builder';

describe('ZipBuilder', () => {
  it('stores every entry and de-duplicates names', async () => {
    const zip = await new ZipBuilder().create([
      { name: 'page-1.png', blob: new Blob(['one']) },
      { name: 'page-2.png', blob: new Blob(['two']) },
      { name: 'page-1.png', blob: new Blob(['again']) },
    ]);

    expect(zip.type).toBe('application/zip');
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    const text = (name: string) => new TextDecoder().decode(files[name]);
    expect(Object.keys(files)).toEqual(['page-1.png', 'page-2.png', 'page-1 (2).png']);
    expect(text('page-2.png')).toBe('two');
    expect(text('page-1 (2).png')).toBe('again');
  });
});
