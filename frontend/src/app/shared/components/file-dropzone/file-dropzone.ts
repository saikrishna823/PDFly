import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

import { FileSelection, partitionFiles } from '../../utils/file-accept';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-file-dropzone',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-dropzone.html',
  styleUrl: './file-dropzone.css',
})
export class FileDropzone {
  /** Same syntax as the `accept` attribute, e.g. ".pdf" or ".jpg,.jpeg,.png". */
  readonly accept = input.required<string>();
  readonly maxBytes = input.required<number>();
  readonly multiple = input(false);
  /** Smaller variant used for "add more files" below an existing list. */
  readonly compact = input(false);
  readonly title = input('Drop your file here');
  readonly buttonLabel = input('Select file');
  /** Human-readable formats/limits, e.g. "JPG, PNG or WebP · up to 100 MB". */
  readonly hint = input('');

  readonly selected = output<FileSelection>();

  protected readonly dragging = signal(false);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private dragDepth = 0;

  protected openPicker(event?: Event): void {
    event?.stopPropagation();
    this.fileInput().nativeElement.click();
  }

  protected onInputChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.emit(Array.from(inputEl.files ?? []));
    inputEl.value = ''; // allow choosing the same file again
  }

  protected onDragEnter(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    event.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.emit(this.multiple() ? files : files.slice(0, 1));
  }

  private emit(files: File[]): void {
    if (files.length) {
      this.selected.emit(partitionFiles(files, this.accept(), this.maxBytes()));
    }
  }

  private hasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }
}
