import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ImagePdfOptions } from '../../models/image-pdf-options';
import { ImageItem } from '../../services/image-loader';
import { computePageLayout } from '../../services/page-layout';
import { Icon } from '../../shared/components/icon/icon';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { PagePreview } from './page-preview';

export interface MoveRequest {
  from: number;
  to: number;
}

export interface RotateRequest {
  id: number;
  delta: 90 | -90;
}

/**
 * Pages to be generated, each previewed exactly as it will appear in the PDF.
 * Reordering works by drag and drop (pointer) or the move buttons (keyboard / touch).
 */
@Component({
  selector: 'app-image-page-list',
  imports: [Icon, FileSizePipe, PagePreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-page-list.html',
  styleUrl: './image-page-list.css',
})
export class ImagePageList {
  readonly items = input.required<readonly ImageItem[]>();
  readonly options = input.required<ImagePdfOptions>();
  readonly reorderable = input(false);

  readonly remove = output<number>();
  readonly rotate = output<RotateRequest>();
  readonly move = output<MoveRequest>();

  protected readonly pages = computed(() =>
    this.items().map((item) => ({
      item,
      layout: computePageLayout({ width: item.width, height: item.height }, item.rotation, this.options()),
    })),
  );

  protected readonly announcement = signal('');
  protected readonly dragIndex = signal<number | null>(null);
  protected readonly dropIndex = signal<number | null>(null);

  protected moveBy(index: number, delta: -1 | 1): void {
    const to = index + delta;
    const item = this.items()[index];
    this.move.emit({ from: index, to });
    this.announcement.set(`Moved ${item.file.name} to position ${to + 1} of ${this.items().length}.`);
  }

  protected onRemove(item: ImageItem): void {
    this.remove.emit(item.id);
    this.announcement.set(`Removed ${item.file.name}.`);
  }

  protected onDragStart(event: DragEvent, index: number): void {
    if (!this.reorderable() || !event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index)); // required by Firefox
    this.dragIndex.set(index);
  }

  protected onDragOver(event: DragEvent, index: number): void {
    if (this.dragIndex() === null) return;
    event.preventDefault();
    this.dropIndex.set(index);
  }

  protected onDrop(event: DragEvent, index: number): void {
    const from = this.dragIndex();
    if (from === null) return;
    event.preventDefault();
    if (from !== index) {
      this.move.emit({ from, to: index });
    }
    this.onDragEnd();
  }

  protected onDragEnd(): void {
    this.dragIndex.set(null);
    this.dropIndex.set(null);
  }
}
