import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { APP_CONFIG } from '../../core/config/app-config.token';
import {
  DEFAULT_PDF_IMAGE_OPTIONS,
  FORMAT_CHOICES,
  IMAGE_EXTENSION,
  RESOLUTION_CHOICES,
} from '../../models/pdf-image-options';
import { getTool } from '../../models/tool';
import { PdfDocument, PdfOpenError, PdfRenderer } from '../../services/pdf-renderer';
import { ZipBuilder } from '../../services/zip-builder';
import { ErrorAlert } from '../../shared/components/error-alert/error-alert';
import { FileDropzone } from '../../shared/components/file-dropzone/file-dropzone';
import { Icon } from '../../shared/components/icon/icon';
import { ProgressIndicator } from '../../shared/components/progress-indicator/progress-indicator';
import { ResultPanel } from '../../shared/components/result-panel/result-panel';
import { ToolHeader } from '../../shared/components/tool-header/tool-header';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { downloadBlob } from '../../shared/utils/download';
import { FileSelection } from '../../shared/utils/file-accept';
import { deriveFileName, fileStem } from '../../shared/utils/file-names';
import { formatPageRanges, parsePageRanges } from '../../shared/utils/page-ranges';
import { PagePicker, PageThumb } from './page-picker';

type Phase = 'select' | 'opening' | 'configure' | 'processing' | 'done';

interface OutputImage {
  pageNumber: number;
  name: string;
  blob: Blob;
  url: string;
}

interface ConversionResult {
  fileName: string;
  blob: Blob;
  /** Individual images, listed only when several pages were converted. */
  images: OutputImage[];
  downscaled: boolean;
}

const THUMBNAIL_WIDTH = 150;

/** Upload → choose pages and settings → render → download, entirely in the browser with pdf.js. */
@Component({
  selector: 'app-pdf-to-image',
  imports: [
    ReactiveFormsModule,
    ToolHeader,
    FileDropzone,
    PagePicker,
    ProgressIndicator,
    ResultPanel,
    ErrorAlert,
    Icon,
    FileSizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-to-image.html',
  styleUrl: './pdf-to-image.css',
})
export class PdfToImage {
  private readonly renderer = inject(PdfRenderer);
  private readonly zip = inject(ZipBuilder);
  private readonly config = inject(APP_CONFIG);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tool = getTool('pdf-to-image');
  protected readonly maxBytes = this.config.maxLocalFileMb * 1024 * 1024;
  protected readonly hint = `PDF · up to ${this.config.maxLocalFileMb} MB`;
  protected readonly formats = FORMAT_CHOICES;
  protected readonly resolutions = RESOLUTION_CHOICES;

  protected readonly form = this.fb.group({
    format: this.fb.control(DEFAULT_PDF_IMAGE_OPTIONS.format),
    dpi: this.fb.control(DEFAULT_PDF_IMAGE_OPTIONS.dpi),
    quality: this.fb.control(DEFAULT_PDF_IMAGE_OPTIONS.quality),
  });
  protected readonly rangeForm = this.fb.group({ range: '' });
  protected readonly format = toSignal(this.form.controls.format.valueChanges, {
    initialValue: this.form.controls.format.value,
  });
  protected readonly quality = toSignal(this.form.controls.quality.valueChanges, {
    initialValue: this.form.controls.quality.value,
  });

  protected readonly phase = signal<Phase>('select');
  protected readonly file = signal<File | null>(null);
  protected readonly pages = signal<PageThumb[]>([]);
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly rangeError = signal<string | null>(null);
  protected readonly progress = signal({ completed: 0, total: 0 });
  protected readonly result = signal<ConversionResult | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly pageCount = computed(() => this.pages().length);
  protected readonly selectionSummary = computed(() => {
    const count = this.selected().size;
    const total = this.pageCount();
    if (count === 0) return 'No pages selected';
    if (count === total) return `All ${total} ${total === 1 ? 'page' : 'pages'} selected`;
    return `${count} of ${total} pages selected: ${formatPageRanges(this.selected())}`;
  });
  protected readonly progressLabel = computed(() => {
    const { completed, total } = this.progress();
    return total > 1 ? `Converting page ${Math.min(completed + 1, total)} of ${total}…` : 'Converting your page…';
  });
  protected readonly progressPercent = computed(() => {
    const { completed, total } = this.progress();
    return total > 1 ? Math.round((completed / total) * 100) : null;
  });

  private doc: PdfDocument | null = null;
  /** Bumped whenever the open document changes, so stale async work is discarded. */
  private session = 0;
  /** Bumped to cancel an in-flight conversion. */
  private conversion = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.closeDocument());
  }

  protected async onSelected(selection: FileSelection): Promise<void> {
    const rejected = selection.rejected[0];
    if (rejected) {
      this.error.set(`${rejected.file.name} ${rejected.reason}. Please choose a PDF file.`);
      return;
    }
    const file = selection.accepted[0];
    if (!file) return;

    this.closeDocument();
    this.error.set(null);
    this.phase.set('opening');
    const session = this.session;

    try {
      const doc = await this.renderer.open(file);
      if (session !== this.session) {
        doc.destroy();
        return;
      }
      this.doc = doc;
      this.file.set(file);
      this.pages.set(Array.from({ length: doc.pageCount }, (_, i) => ({ number: i + 1, thumbUrl: null })));
      this.selectAll();
      this.phase.set('configure');
      void this.renderThumbnails(doc, session);
    } catch (e) {
      if (session !== this.session) return;
      this.error.set(e instanceof PdfOpenError ? e.message : "We couldn't open this PDF. Please try a different file.");
      this.phase.set('select');
    }
  }

  protected togglePage(pageNumber: number): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(pageNumber)) next.add(pageNumber);
      return next;
    });
  }

  protected selectAll(): void {
    this.selected.set(new Set(this.pages().map((p) => p.number)));
    this.rangeError.set(null);
  }

  protected selectNone(): void {
    this.selected.set(new Set());
    this.rangeError.set(null);
  }

  protected applyRange(): void {
    const parsed = parsePageRanges(this.rangeForm.controls.range.value, this.pageCount());
    if (parsed.ok) {
      this.selected.set(new Set(parsed.pages));
      this.rangeError.set(null);
    } else {
      this.rangeError.set(parsed.error);
    }
  }

  protected async convert(): Promise<void> {
    const doc = this.doc;
    const file = this.file();
    const pageNumbers = [...this.selected()].sort((a, b) => a - b);
    if (!doc || !file || !pageNumbers.length) return;

    const options = this.form.getRawValue();
    const conversion = ++this.conversion;
    const digits = String(doc.pageCount).length;
    const outputs: Omit<OutputImage, 'url'>[] = [];
    let downscaled = false;

    this.error.set(null);
    this.progress.set({ completed: 0, total: pageNumbers.length });
    this.phase.set('processing');

    try {
      for (const [index, pageNumber] of pageNumbers.entries()) {
        this.progress.set({ completed: index, total: pageNumbers.length });
        const rendered = await doc.renderPage(pageNumber, options);
        if (conversion !== this.conversion) return; // cancelled
        downscaled ||= rendered.downscaled;
        outputs.push({
          pageNumber,
          name: deriveFileName(file.name, `-page-${String(pageNumber).padStart(digits, '0')}`, IMAGE_EXTENSION[options.format]),
          blob: rendered.blob,
        });
      }
      this.progress.set({ completed: pageNumbers.length, total: pageNumbers.length });

      const single = outputs.length === 1;
      const archive = single ? null : await this.zip.create(outputs);
      if (conversion !== this.conversion) return;

      this.result.set({
        fileName: single ? outputs[0].name : `${fileStem(file.name)}-images.zip`,
        blob: archive ?? outputs[0].blob,
        images: single ? [] : outputs.map((o) => ({ ...o, url: URL.createObjectURL(o.blob) })),
        downscaled,
      });
      this.phase.set('done');
    } catch (e) {
      if (conversion !== this.conversion) return;
      console.error('PDF page rendering failed', e);
      this.error.set(
        "We couldn't convert this PDF. A page may be damaged, or the settings may need more memory than this browser allows — try a lower resolution.",
      );
      this.phase.set('configure');
    }
  }

  protected cancelConversion(): void {
    this.conversion++;
    this.phase.set('configure');
  }

  protected download(): void {
    const result = this.result();
    if (result) downloadBlob(result.blob, result.fileName);
  }

  protected downloadImage(image: OutputImage): void {
    downloadBlob(image.blob, image.name);
  }

  /** Back to page selection and settings, keeping the open PDF. */
  protected changeSettings(): void {
    this.clearResult();
    this.phase.set('configure');
  }

  protected reset(): void {
    this.closeDocument();
    this.error.set(null);
    this.rangeForm.reset();
    this.phase.set('select');
  }

  private async renderThumbnails(doc: PdfDocument, session: number): Promise<void> {
    for (let pageNumber = 1; pageNumber <= doc.pageCount; pageNumber++) {
      try {
        const blob = await doc.renderThumbnail(pageNumber, THUMBNAIL_WIDTH);
        if (session !== this.session) return;
        const url = URL.createObjectURL(blob);
        this.pages.update((pages) => pages.map((p) => (p.number === pageNumber ? { ...p, thumbUrl: url } : p)));
      } catch {
        if (session !== this.session) return;
        // Leave the placeholder; the page may still convert at full size.
      }
    }
  }

  private clearResult(): void {
    for (const image of this.result()?.images ?? []) URL.revokeObjectURL(image.url);
    this.result.set(null);
  }

  private closeDocument(): void {
    this.session++;
    this.conversion++;
    this.clearResult();
    for (const page of this.pages()) {
      if (page.thumbUrl) URL.revokeObjectURL(page.thumbUrl);
    }
    this.pages.set([]);
    this.selected.set(new Set());
    this.rangeError.set(null);
    this.file.set(null);
    this.doc?.destroy();
    this.doc = null;
  }
}
