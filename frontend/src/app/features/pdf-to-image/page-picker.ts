import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface PageThumb {
  number: number;
  /** Object URL of the preview, or null while it is still rendering. */
  thumbUrl: string | null;
}

/** Grid of page previews, each a labelled checkbox. */
@Component({
  selector: 'app-page-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="grid" aria-label="Pages">
      @for (page of pages(); track page.number) {
        @let isSelected = selected().has(page.number);
        <li>
          <label class="page" [class.selected]="isSelected">
            <input type="checkbox" class="check" [checked]="isSelected" (change)="toggle.emit(page.number)" />
            <span class="thumb">
              @if (page.thumbUrl) {
                <img [src]="page.thumbUrl" alt="" />
              } @else {
                <span class="placeholder" aria-hidden="true"></span>
              }
            </span>
            <span class="number">Page {{ page.number }}</span>
          </label>
        </li>
      }
    </ul>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 14px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .page {
      position: relative;
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .page:hover {
      border-color: var(--color-border-strong);
    }
    .page.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
    }
    .page:focus-within {
      outline: 3px solid var(--color-focus);
      outline-offset: 2px;
    }
    .check {
      position: absolute;
      z-index: 1;
      top: 14px;
      right: 14px;
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--color-primary);
      cursor: pointer;
    }
    .check:focus-visible {
      outline: none;
    }
    .thumb {
      display: grid;
      place-items: center;
      aspect-ratio: 3 / 4;
      padding: 4px;
      border-radius: 4px;
      background: var(--color-surface-muted);
      overflow: hidden;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      /* drop-shadow follows the visible page, not the letterboxed box */
      filter: drop-shadow(0 1px 2px rgb(16 24 40 / 0.18));
    }
    .placeholder {
      width: 70%;
      height: 80%;
      border-radius: 2px;
      background: var(--color-border);
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }
    .number {
      font-size: 0.88rem;
      font-weight: 600;
      text-align: center;
    }
    @media (max-width: 480px) {
      .grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .page {
        padding: 6px;
      }
      .check {
        top: 10px;
        right: 10px;
      }
    }
  `,
})
export class PagePicker {
  readonly pages = input.required<readonly PageThumb[]>();
  readonly selected = input.required<ReadonlySet<number>>();
  readonly toggle = output<number>();
}
