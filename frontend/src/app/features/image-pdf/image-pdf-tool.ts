import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { map } from 'rxjs';

import { APP_CONFIG } from '../../core/config/app-config.token';
import { ToolDefinition } from '../../models/tool';
import { ImageConversionError, ImagePdfConverter } from '../../services/image-pdf-converter';
import { ImageItem, ImageLoader, UnreadableImageError } from '../../services/image-loader';
import { rotateBy } from '../../services/page-layout';
import { ErrorAlert } from '../../shared/components/error-alert/error-alert';
import { FileDropzone } from '../../shared/components/file-dropzone/file-dropzone';
import { ProgressIndicator } from '../../shared/components/progress-indicator/progress-indicator';
import { ResultPanel } from '../../shared/components/result-panel/result-panel';
import { ToolHeader } from '../../shared/components/tool-header/tool-header';
import { downloadBlob } from '../../shared/utils/download';
import { FileSelection } from '../../shared/utils/file-accept';
import { fileStem } from '../../shared/utils/file-names';
import { ImagePageList, MoveRequest, RotateRequest } from './image-page-list';
import { ImagePdfSettings, createImagePdfOptionsForm } from './image-pdf-settings';

const MAX_IMAGES = 200;
const ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

type Phase = 'edit' | 'processing' | 'done';

/** Upload → configure/preview → convert → download, for one or many images. Runs fully in the browser. */
@Component({
  selector: 'app-image-pdf-tool',
  imports: [ToolHeader, FileDropzone, ImagePageList, ImagePdfSettings, ProgressIndicator, ResultPanel, ErrorAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-pdf-tool.html',
  styleUrl: './image-pdf-tool.css',
})
export class ImagePdfTool {
  readonly tool = input.required<ToolDefinition>();
  readonly multiple = input(false);

  private readonly loader = inject(ImageLoader);
  private readonly converter = inject(ImagePdfConverter);
  private readonly config = inject(APP_CONFIG);

  protected readonly accept = ACCEPT;
  protected readonly maxBytes = this.config.maxLocalFileMb * 1024 * 1024;
  protected readonly form = createImagePdfOptionsForm(inject(NonNullableFormBuilder));
  protected readonly options = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected readonly items = signal<ImageItem[]>([]);
  protected readonly phase = signal<Phase>('edit');
  protected readonly loadingCount = signal(0);
  protected readonly progress = signal({ completed: 0, total: 0 });
  protected readonly result = signal<{ blob: Blob; fileName: string } | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly skipped = signal<string[]>([]);

  protected readonly hint = computed(
    () => `JPG, PNG or WebP · up to ${this.config.maxLocalFileMb} MB ${this.multiple() ? 'each' : ''}`,
  );
  protected readonly progressLabel = computed(() => {
    const { completed, total } = this.progress();
    return total > 1 ? `Adding image ${Math.min(completed + 1, total)} of ${total}…` : 'Creating your PDF…';
  });
  protected readonly progressPercent = computed(() => {
    const { completed, total } = this.progress();
    return total > 1 ? Math.round((completed / total) * 100) : null;
  });

  /** Bumped on reset so late-finishing loads from a previous session are discarded. */
  private session = 0;

  constructor() {
    // Orientation and fit don't apply when each page takes its image's size.
    this.form.controls.pageSize.valueChanges.pipe(takeUntilDestroyed()).subscribe((pageSize) => {
      for (const control of [this.form.controls.orientation, this.form.controls.fit]) {
        if (pageSize === 'image') control.disable({ emitEvent: false });
        else control.enable({ emitEvent: false });
      }
    });
    inject(DestroyRef).onDestroy(() => this.loader.release(this.items()));
  }

  protected async addFiles(selection: FileSelection): Promise<void> {
    this.error.set(null);
    const skipped = selection.rejected.map((r) => `${r.file.name} ${r.reason}.`);
    let files = selection.accepted;

    if (this.multiple()) {
      const room = MAX_IMAGES - this.items().length;
      if (files.length > room) {
        skipped.push(`You can combine up to ${MAX_IMAGES} images at once; ${files.length - room} were not added.`);
        files = files.slice(0, Math.max(room, 0));
      }
    } else {
      files = files.slice(0, 1);
    }

    const session = this.session;
    this.loadingCount.set(files.length);
    // Load one at a time: decoding many large photos in parallel can exhaust memory.
    for (const file of files) {
      try {
        const item = await this.loader.load(file);
        if (session !== this.session) {
          this.loader.release([item]);
          return;
        }
        if (this.multiple()) {
          this.items.update((items) => [...items, item]);
        } else {
          this.loader.release(this.items());
          this.items.set([item]);
        }
      } catch (e) {
        skipped.push(e instanceof UnreadableImageError ? e.message : `${file.name} couldn't be read.`);
      }
      this.loadingCount.update((n) => n - 1);
    }
    this.skipped.set(skipped);
  }

  protected removeItem(id: number): void {
    const removed = this.items().filter((item) => item.id === id);
    this.loader.release(removed);
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  protected rotateItem({ id, delta }: RotateRequest): void {
    this.items.update((items) =>
      items.map((item) => (item.id === id ? { ...item, rotation: rotateBy(item.rotation, delta) } : item)),
    );
  }

  protected moveItem({ from, to }: MoveRequest): void {
    this.items.update((items) => {
      if (to < 0 || to >= items.length) return items;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  protected async convert(): Promise<void> {
    const items = this.items();
    if (!items.length) return;

    this.error.set(null);
    this.skipped.set([]);
    this.progress.set({ completed: 0, total: items.length });
    this.phase.set('processing');

    const baseName = fileStem(items[0].file.name);
    const fileName = items.length > 1 ? `${baseName}-combined.pdf` : `${baseName}.pdf`;
    try {
      const blob = await this.converter.createPdf(
        items.map((item) => ({ file: item.file, rotation: item.rotation })),
        this.options(),
        fileName.replace(/\.pdf$/, ''),
        (completed, total) => this.progress.set({ completed, total }),
      );
      this.result.set({ blob, fileName });
      this.phase.set('done');
    } catch (e) {
      console.error('PDF creation failed', e);
      this.error.set(
        e instanceof ImageConversionError
          ? e.message
          : "We couldn't create the PDF. One of the images may be damaged or too large for this browser.",
      );
      this.phase.set('edit');
    }
  }

  protected download(): void {
    const result = this.result();
    if (result) downloadBlob(result.blob, result.fileName);
  }

  protected reset(): void {
    this.session++;
    this.loader.release(this.items());
    this.items.set([]);
    this.loadingCount.set(0);
    this.result.set(null);
    this.error.set(null);
    this.skipped.set([]);
    this.phase.set('edit');
  }
}
