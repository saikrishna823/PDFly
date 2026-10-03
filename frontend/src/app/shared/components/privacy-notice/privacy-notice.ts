import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ProcessingLocation } from '../../../models/tool';
import { Icon } from '../icon/icon';

/** States exactly where processing happens. Keep the copy accurate — no absolute claims. */
@Component({
  selector: 'app-privacy-notice',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="notice" [class.server]="processing() === 'server'">
      <app-icon [name]="processing() === 'local' ? 'device' : 'server'" [size]="22" />
      <div>
        @if (processing() === 'local') {
          <p class="title">Processed locally</p>
          <p class="body">Your file does not leave your device. Everything happens in this browser tab.</p>
        } @else {
          <p class="title">Temporary server processing</p>
          <p class="body">
            Your file is sent over an encrypted connection, processed temporarily and is not permanently stored.
          </p>
        }
      </div>
    </div>
  `,
  styles: `
    .notice {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      background: var(--color-local-soft);
      color: var(--color-local);
    }
    .notice.server {
      background: var(--color-server-soft);
      color: var(--color-server);
    }
    .title {
      font-weight: 650;
    }
    .body {
      color: var(--color-text);
      font-size: 0.92rem;
    }
  `,
})
export class PrivacyNotice {
  readonly processing = input.required<ProcessingLocation>();
}
