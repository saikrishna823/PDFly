import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { APP_CONFIG } from '../config/app-config.token';

@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="site-footer">
      <div class="container inner">
        <p>
          <strong>PDFly</strong> — private PDF tools. Browser-based tools never upload your files; server-based tools
          delete them right after processing.
        </p>
        <a [href]="repositoryUrl" rel="noopener" target="_blank">Source code on GitHub</a>
      </div>
    </footer>
  `,
  styles: `
    .site-footer {
      border-top: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      font-size: 0.9rem;
    }
    .inner {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 24px;
      align-items: center;
      justify-content: space-between;
      padding-block: 24px;
    }
    p {
      max-width: 70ch;
    }
    a {
      font-weight: 600;
    }
  `,
})
export class SiteFooter {
  protected readonly repositoryUrl = inject(APP_CONFIG).repositoryUrl;
}
