import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { APP_CONFIG } from '../../core/config/app-config.token';
import { PDF_LEVEL_CHOICES, PdfCompressionLevel } from '../../models/compression-options';
import { getTool } from '../../models/tool';
import { PdfCompressionResult, PdfCompressor } from '../../services/pdf-compressor';
import { PdfOpenError } from '../../services/pdf-renderer';
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

type Phase = 'select' | 'configure' | 'processing' | 'done';

/** Upload → choose a level → compress → download. Runs entirely in the browser. */
@Component({
  selector: 'app-compress-pdf',
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
  templateUrl: './compress-pdf.html',
  styleUrl: './compress-pdf.css',
})
export class CompressPdf {
  private readonly compressor = inject(PdfCompressor);
  private readonly config = inject(APP_CONFIG);

  protected readonly tool = getTool('compress-pdf');
  protected readonly maxBytes = this.config.maxLocalFileMb * 1024 * 1024;
  protected readonly hint = `PDF · up to ${this.config.maxLocalFileMb} MB`;
  protected readonly levels = PDF_LEVEL_CHOICES;

  protected readonly levelControl = inject(NonNullableFormBuilder).control<PdfCompressionLevel>('recommended');
  protected readonly level = toSignal(this.levelControl.valueChanges, { initialValue: this.levelControl.value });

  protected readonly phase = signal<Phase>('select');
  protected readonly file = signal<File | null>(null);
  protected readonly progress = signal({ completed: 0, total: 0 });
  protected readonly result = signal<(PdfCompressionResult & { fileName: string }) | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly progressLabel = computed(() => {
    const { completed, total } = this.progress();
    if (!total) return 'Compressing your PDF…';
    const current = Math.min(completed + 1, total);
    return this.level() === 'maximum' ? `Compressing page ${current} of ${total}…` : `Optimizing image ${current} of ${total}…`;
  });
  protected readonly progressPercent = computed(() => {
    const { completed, total } = this.progress();
    return total ? Math.round((completed / total) * 100) : null;
  });

  /** Bumped to cancel an in-flight compression. */
  private run = 0;

  protected onSelected(selection: FileSelection): void {
    const rejected = selection.rejected[0];
    if (rejected) {
      this.error.set(`${rejected.file.name} ${rejected.reason}. Please choose a PDF file.`);
      return;
    }
    const file = selection.accepted[0];
    if (!file) return;
    this.error.set(null);
    this.file.set(file);
    this.phase.set('configure');
  }

  protected async compress(): Promise<void> {
    const file = this.file();
    if (!file) return;
    const run = ++this.run;
    this.error.set(null);
    this.progress.set({ completed: 0, total: 0 });
    this.phase.set('processing');

    try {
      const result = await this.compressor.compress(file, this.levelControl.value, (completed, total) => {
        if (run === this.run) this.progress.set({ completed, total });
      });
      if (run !== this.run) return;
      this.result.set({ ...result, fileName: deriveFileName(file.name, '-compressed', 'pdf') });
      this.phase.set('done');
    } catch (e) {
      if (run !== this.run) return;
      if (!(e instanceof PdfOpenError)) console.error('PDF compression failed', e);
      const message =
        e instanceof PdfOpenError && e.kind === 'password'
          ? "This PDF is password protected, so it can't be compressed. Remove the password in your PDF app, then try again."
          : e instanceof PdfOpenError
            ? "We couldn't read this PDF. It may be damaged. If it opens in your PDF viewer, try the Maximum level."
            : "We couldn't compress this PDF. Try a different level, or a smaller file if your device is low on memory.";
      this.error.set(message);
      if (e instanceof PdfOpenError && e.kind === 'password') {
        // No level can help with a locked file, so go back to choosing one.
        this.file.set(null);
        this.phase.set('select');
      } else {
        this.phase.set('configure');
      }
    }
  }

  protected cancel(): void {
    this.run++;
    this.phase.set('configure');
  }

  protected download(): void {
    const result = this.result();
    const file = this.file();
    if (!result || !file) return;
    downloadBlob(result.blob, result.keptOriginal ? file.name : result.fileName);
  }

  protected changeLevel(): void {
    this.result.set(null);
    this.phase.set('configure');
  }

  protected reset(): void {
    this.run++;
    this.file.set(null);
    this.result.set(null);
    this.error.set(null);
    this.phase.set('select');
  }
}
