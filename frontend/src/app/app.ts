import { ChangeDetectionStrategy, Component, ElementRef, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteFooter } from './core/layout/site-footer';
import { SiteHeader } from './core/layout/site-header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // A file dropped outside a drop zone would make the browser navigate away and lose work.
    '(window:dragover)': 'preventFileNavigation($event)',
    '(window:drop)': 'preventFileNavigation($event)',
  },
  template: `
    <a class="skip-link" href="#main" (click)="skipToMain($event)">Skip to main content</a>
    <app-site-header />
    <main id="main" #main tabindex="-1">
      <router-outlet />
    </main>
    <app-site-footer />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    main {
      flex: 1;
    }
    main:focus {
      outline: none;
    }
    .skip-link {
      position: absolute;
      left: 12px;
      top: -60px;
      z-index: 100;
      padding: 10px 16px;
      border-radius: var(--radius-sm);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-weight: 600;
    }
    .skip-link:focus {
      top: 12px;
    }
  `,
})
export class App {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  /** Handled in code because "#main" would resolve against <base href> and reload the app. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  protected preventFileNavigation(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
    }
  }
}
