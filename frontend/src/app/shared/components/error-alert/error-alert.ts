import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

@Component({
  selector: 'app-error-alert',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert" role="alert">
      <app-icon name="alert" [size]="22" />
      <div class="content">
        @if (title()) {
          <p class="title">{{ title() }}</p>
        }
        @if (message()) {
          <p>{{ message() }}</p>
        }
        <ng-content />
      </div>
      @if (dismissible()) {
        <button type="button" class="icon-btn" aria-label="Dismiss message" (click)="dismiss.emit()">
          <app-icon name="close" [size]="16" />
        </button>
      }
    </div>
  `,
  styles: `
    .alert {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 14px 16px;
      border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
      border-radius: var(--radius-md);
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }
    .content {
      flex: 1;
      min-width: 0;
      color: var(--color-text);
    }
    .title {
      font-weight: 650;
    }
    .icon-btn {
      background: transparent;
    }
  `,
})
export class ErrorAlert {
  readonly message = input('');
  readonly title = input('');
  readonly dismissible = input(true);
  readonly dismiss = output<void>();
}
