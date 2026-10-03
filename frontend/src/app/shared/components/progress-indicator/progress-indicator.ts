import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Determinate when `percent` is a number, indeterminate when it is null. */
@Component({
  selector: 'app-progress-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progress">
      <p class="label" role="status">{{ label() }}</p>
      <div
        class="track"
        role="progressbar"
        [attr.aria-label]="label()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent()"
      >
        <div class="bar" [class.indeterminate]="percent() === null" [style.width.%]="percent() ?? 35"></div>
      </div>
    </div>
  `,
  styles: `
    .progress {
      display: grid;
      gap: 10px;
      padding: 24px;
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
    }
    .label {
      font-weight: 600;
    }
    .track {
      height: 8px;
      border-radius: 999px;
      background: var(--color-border);
      overflow: hidden;
    }
    .bar {
      height: 100%;
      border-radius: inherit;
      background: var(--color-primary);
      transition: width 0.2s ease;
    }
    .bar.indeterminate {
      animation: slide 1.2s ease-in-out infinite;
    }
    @keyframes slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(300%);
      }
    }
  `,
})
export class ProgressIndicator {
  readonly label = input.required<string>();
  readonly percent = input<number | null>(null);
}
