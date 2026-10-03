import { formatFileSize } from '../pipes/file-size.pipe';
import { partitionFiles } from './file-accept';
import { deriveFileName, fileStem } from './file-names';

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

describe('partitionFiles', () => {
  const accept = '.jpg,.png,image/webp';

  it('accepts by extension or MIME type and explains rejections', () => {
    const { accepted, rejected } = partitionFiles(
      [file('a.JPG', ''), file('b.webp', 'image/webp'), file('c.pdf', 'application/pdf'), file('d.png', 'image/png', 0)],
      accept,
      1024,
    );

    expect(accepted.map((f) => f.name)).toEqual(['a.JPG', 'b.webp']);
    expect(rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ['c.pdf', "isn't a supported file type"],
      ['d.png', 'is empty'],
    ]);
  });

  it('enforces the size limit', () => {
    const { rejected } = partitionFiles([file('big.png', 'image/png', 3 * 1024 * 1024)], accept, 2 * 1024 * 1024);
    expect(rejected[0].reason).toBe('is larger than 2 MB');
  });
});

describe('file names', () => {
  it('derives output names', () => {
    expect(fileStem('Holiday photo.final.jpg')).toBe('Holiday photo.final');
    expect(fileStem('.hidden')).toBe('.hidden');
    expect(deriveFileName('report.pdf', '-page-1', '.png')).toBe('report-page-1.png');
  });
});

describe('formatFileSize', () => {
  it('formats human-readable sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(25 * 1024 * 1024)).toBe('25 MB');
  });
});
