import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="site-header">
      <div class="container bar">
        <a routerLink="/" class="brand" aria-label="PDFly home">
          <svg class="logo" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="currentColor" />
            <path d="M11 8h7l5 5v11a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" fill="#fff" />
            <path d="M18 8v5h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
            <path d="M12.5 19.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>PDFly</span>
        </a>
        <nav aria-label="Main">
          <a routerLink="/" fragment="tools">Tools</a>
          <a routerLink="/" fragment="privacy">Privacy</a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    .site-header {
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-surface) 88%, transparent);
      backdrop-filter: saturate(1.4) blur(10px);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 64px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--color-text);
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      text-decoration: none;
    }
    .logo {
      color: var(--color-primary);
    }
    nav {
      display: flex;
      gap: 4px;
    }
    nav a {
      display: inline-flex;
      align-items: center;
      min-height: var(--tap);
      padding: 0 12px;
      border-radius: 999px;
      color: var(--color-text-muted);
      font-weight: 600;
      text-decoration: none;
    }
    nav a:hover {
      color: var(--color-primary);
      background: var(--color-primary-soft);
    }
  `,
})
export class SiteHeader {}
