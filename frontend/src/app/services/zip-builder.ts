import { Injectable } from '@angular/core';
import { zipSync } from 'fflate';

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/** Packs files into a ZIP in the browser. Images are already compressed, so entries are stored as-is. */
@Injectable({ providedIn: 'root' })
export class ZipBuilder {
  async create(entries: readonly ZipEntry[]): Promise<Blob> {
    const files: Record<string, Uint8Array> = {};
    for (const entry of entries) {
      files[uniqueName(entry.name, files)] = new Uint8Array(await entry.blob.arrayBuffer());
    }
    const bytes = zipSync(files, { level: 0 });
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
  }
}

function uniqueName(name: string, taken: Record<string, unknown>): string {
  if (!(name in taken)) return name;
  const dot = name.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let n = 2;
  while (`${stem} (${n})${ext}` in taken) n++;
  return `${stem} (${n})${ext}`;
}
