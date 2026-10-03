import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ToolDefinition } from '../../../models/tool';
import { Icon } from '../icon/icon';
import { PrivacyNotice } from '../privacy-notice/privacy-notice';

@Component({
  selector: 'app-tool-header',
  imports: [Icon, PrivacyNotice, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/" class="back"><app-icon name="arrow-left" [size]="18" /> All tools</a>
    <header class="header">
      <span class="tool-icon"><app-icon [name]="tool().icon" [size]="28" /></span>
      <div>
        <h1>{{ tool().title }}</h1>
        <p class="description">{{ tool().description }}</p>
      </div>
    </header>
    <app-privacy-notice [processing]="tool().processing" />
  `,
  styles: `
    :host {
      display: grid;
      gap: 20px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: fit-content;
      min-height: var(--tap);
      color: var(--color-text-muted);
      font-weight: 600;
      text-decoration: none;
    }
    .back:hover {
      color: var(--color-primary);
    }
    .header {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .tool-icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    h1 {
      font-size: clamp(1.6rem, 3vw, 2.1rem);
    }
    .description {
      color: var(--color-text-muted);
      margin-top: 4px;
    }
  `,
})
export class ToolHeader {
  readonly tool = input.required<ToolDefinition>();
}
