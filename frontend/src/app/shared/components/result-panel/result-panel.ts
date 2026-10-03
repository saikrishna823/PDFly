import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';

import { FileSizePipe } from '../../pipes/file-size.pipe';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-result-panel',
  imports: [Icon, FileSizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="result" aria-labelledby="result-title">
      <span class="check"><app-icon name="check-circle" [size]="40" /></span>
      <h2 id="result-title" tabindex="-1" #headingEl>{{ heading() }}</h2>
      <p class="file">
        {{ fileName() }} <span class="size">· {{ fileSize() | fileSize }}</span>
      </p>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-lg" (click)="download.emit()">
          <app-icon name="download" /> {{ downloadLabel() }}
        </button>
        <button type="button" class="btn btn-secondary btn-lg" (click)="reset.emit()">
          <app-icon name="rotate-ccw" /> {{ resetLabel() }}
        </button>
      </div>
      <ng-content />
    </section>
  `,
  styles: `
    .result {
      display: grid;
      justify-items: center;
      gap: 12px;
      padding: 32px 16px;
      text-align: center;
    }
    .check {
      color: var(--color-success);
    }
    h2 {
      font-size: 1.5rem;
    }
    h2:focus {
      outline: none;
    }
    .file {
      font-weight: 600;
      word-break: break-word;
    }
    .size {
      color: var(--color-text-muted);
      font-weight: 400;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 8px;
    }
    @media (max-width: 640px) {
      .actions {
        width: 100%;
      }
      .actions .btn {
        flex: 1 1 100%;
      }
    }
  `,
})
export class ResultPanel {
  readonly fileName = input.required<string>();
  readonly fileSize = input.required<number>();
  readonly heading = input('Your file is ready');
  readonly downloadLabel = input('Download');
  readonly resetLabel = input('Process another file');

  readonly download = output<void>();
  readonly reset = output<void>();

  private readonly headingEl = viewChild.required<ElementRef<HTMLElement>>('headingEl');

  constructor() {
    // Move focus to the result so keyboard and screen-reader users land on it.
    afterNextRender(() => this.headingEl().nativeElement.focus());
  }
}
