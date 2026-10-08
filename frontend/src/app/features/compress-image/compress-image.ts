import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

import { APP_CONFIG } from '../../core/config/app-config.token';
import {
  COMPRESS_FORMAT_CHOICES,
  CompressFormat,
  ImageCompressOptions,
  MAX_DIMENSION_CHOICES,
  MIME_EXTENSION,
  SizeUnit,
} from '../../models/compression-options';
import { getTool } from '../../models/tool';
import { CompressedImage, ImageCompressionError, ImageCompressor } from '../../services/image-compressor';
import { ZipBuilder } from '../../services/zip-builder';
import { ErrorAlert } from '../../shared/components/error-alert/error-alert';
import { FileDropzone } from '../../shared/components/file-dropzone/file-dropzone';
import { Icon } from '../../shared/components/icon/icon';
import { ProgressIndicator } from '../../shared/components/progress-indicator/progress-indicator';
import { ResultPanel } from '../../shared/components/result-panel/result-panel';
import { SizeChange } from '../../shared/components/size-change/size-change';
import { ToolHeader } from '../../shared/components/tool-header/tool-header';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { downloadBlob } from '../../shared/utils/download';
import { FileSelection } from '../../shared/utils/file-accept';
import { deriveFileName } from '../../shared/utils/file-names';

type Phase = 'edit' | 'processing' | 'done';

interface InputImage {
  id: number;
  file: File;
  previewUrl: string;
}

interface OutputImage {
  input: InputImage;
  result: CompressedImage;
  name: string;
  url: string;
}

const MAX_IMAGES = 100;
const ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const UNIT_BYTES: Record<SizeUnit, number> = { KB: 1024, MB: 1024 * 1024 };

/** Pick images → choose quality or a target size → compress → download. Runs in the browser. */
@Component({
  selector: 'app-compress-image',
  imports: [
    ReactiveFormsModule,
    ToolHeader,
    FileDropzone,
    ProgressIndicator,
    ResultPanel,
    ErrorAlert,
    SizeChange,
    Icon,
    FileSizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compress-image.html',
  styleUrl: './compress-image.css',
})
export class CompressImage {
  private readonly compressor = inject(ImageCompressor);
  private readonly zip = inject(ZipBuilder);
  private readonly config = inject(APP_CONFIG);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tool = getTool('compress-image');
  protected readonly accept = ACCEPT;
  protected readonly maxBytes = this.config.maxLocalFileMb * 1024 * 1024;
  protected readonly hint = `JPG, PNG or WebP · up to ${this.config.maxLocalFileMb} MB each`;
  protected readonly formats = COMPRESS_FORMAT_CHOICES;
  protected readonly dimensions = MAX_DIMENSION_CHOICES;

  protected readonly form = this.fb.group({
    mode: this.fb.control<'quality' | 'target'>('quality'),
    quality: this.fb.control(70),
    targetValue: this.fb.control(200, [Validators.required, Validators.min(1)]),
    targetUnit: this.fb.control<SizeUnit>('KB'),
    maxDimension: this.fb.control<number | null>(null),
    format: this.fb.control<CompressFormat>('auto'),
  });
  protected readonly settings = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected readonly items = signal<InputImage[]>([]);
  protected readonly phase = signal<Phase>('edit');
  protected readonly progress = signal({ completed: 0, total: 0 });
  protected readonly outputs = signal<OutputImage[]>([]);
  protected readonly archive = signal<{ blob: Blob; fileName: string } | null>(null);
  protected readonly failures = signal<string[]>([]);
  protected readonly skipped = signal<string[]>([]);

  protected readonly totalBefore = computed(() => this.outputs().reduce((sum, o) => sum + o.input.file.size, 0));
  protected readonly totalAfter = computed(() => this.outputs().reduce((sum, o) => sum + o.result.blob.size, 0));
  protected readonly targetTooSmall = computed(() => {
    const s = this.settings();
    return s.mode === 'target' && s.targetValue * UNIT_BYTES[s.targetUnit] < 10 * 1024;
  });
  protected readonly progressLabel = computed(() => {
    const { completed, total } = this.progress();
    return total > 1 ? `Compressing image ${Math.min(completed + 1, total)} of ${total}…` : 'Compressing your image…';
  });
  protected readonly progressPercent = computed(() => {
    const { completed, total } = this.progress();
    return total > 1 ? Math.round((completed / total) * 100) : null;
  });

  private nextId = 1;
  private run = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.run++;
      this.clearOutputs();
      for (const item of this.items()) URL.revokeObjectURL(item.previewUrl);
    });
  }

  protected addFiles(selection: FileSelection): void {
    const skipped = selection.rejected.map((r) => `${r.file.name} ${r.reason}.`);
    const room = MAX_IMAGES - this.items().length;
    let files = selection.accepted;
    if (files.length > room) {
      skipped.push(`You can compress up to ${MAX_IMAGES} images at once; ${files.length - room} were not added.`);
      files = files.slice(0, Math.max(room, 0));
    }
    this.items.update((items) => [
      ...items,
      ...files.map((file) => ({ id: this.nextId++, file, previewUrl: URL.createObjectURL(file) })),
    ]);
    this.skipped.set(skipped);
  }

  protected removeItem(item: InputImage): void {
    URL.revokeObjectURL(item.previewUrl);
    this.items.update((items) => items.filter((i) => i.id !== item.id));
  }

  protected async compress(): Promise<void> {
    const items = this.items();
    if (!items.length || this.form.invalid || this.targetTooSmall()) {
      this.form.markAllAsTouched();
      return;
    }

    const options = this.toOptions();
    const run = ++this.run;
    const outputs: OutputImage[] = [];
    const failures: string[] = [];
    this.clearOutputs();
    this.failures.set([]);
    this.skipped.set([]);
    this.progress.set({ completed: 0, total: items.length });
    this.phase.set('processing');

    for (const [index, item] of items.entries()) {
      this.progress.set({ completed: index, total: items.length });
      try {
        const result = await this.compressor.compress(item.file, options);
        if (run !== this.run) return;
        const name = result.keptOriginal
          ? item.file.name
          : deriveFileName(item.file.name, '-compressed', MIME_EXTENSION[result.mime]);
        outputs.push({ input: item, result, name, url: URL.createObjectURL(result.blob) });
      } catch (e) {
        if (run !== this.run) return;
        failures.push(e instanceof ImageCompressionError ? e.message : `${item.file.name} couldn't be compressed.`);
      }
    }
    this.progress.set({ completed: items.length, total: items.length });

    if (outputs.length > 1) {
      const blob = await this.zip.create(outputs.map((o) => ({ name: o.name, blob: o.result.blob })));
      if (run !== this.run) return;
      this.archive.set({ blob, fileName: 'compressed-images.zip' });
    }
    this.outputs.set(outputs);
    this.failures.set(failures);
    this.phase.set(outputs.length ? 'done' : 'edit');
  }

  protected cancel(): void {
    this.run++;
    this.phase.set('edit');
  }

  protected downloadAll(): void {
    const archive = this.archive();
    const single = this.outputs()[0];
    if (archive) downloadBlob(archive.blob, archive.fileName);
    else if (single) downloadBlob(single.result.blob, single.name);
  }

  protected downloadOne(output: OutputImage): void {
    downloadBlob(output.result.blob, output.name);
  }

  protected changeSettings(): void {
    this.clearOutputs();
    this.phase.set('edit');
  }

  protected reset(): void {
    this.run++;
    this.clearOutputs();
    for (const item of this.items()) URL.revokeObjectURL(item.previewUrl);
    this.items.set([]);
    this.failures.set([]);
    this.skipped.set([]);
    this.phase.set('edit');
  }

  protected noteFor(output: OutputImage): string {
    const { result } = output;
    if (result.keptOriginal) {
      return result.metTarget === false
        ? "Couldn't reach the target size; the original was smaller."
        : 'Already well compressed — original kept.';
    }
    const notes: string[] = [];
    if (result.metTarget === false) notes.push("Couldn't reach the target size; this is the smallest we could make it.");
    if (result.usedFallback) notes.push("This browser can't save WebP, so another format was used.");
    return notes.join(' ');
  }

  private toOptions(): ImageCompressOptions {
    const s = this.form.getRawValue();
    return {
      format: s.format,
      maxDimension: s.maxDimension,
      quality: s.quality / 100,
      targetBytes: s.mode === 'target' ? Math.round(s.targetValue * UNIT_BYTES[s.targetUnit]) : null,
    };
  }

  private clearOutputs(): void {
    for (const output of this.outputs()) URL.revokeObjectURL(output.url);
    this.outputs.set([]);
    this.archive.set(null);
  }
}
