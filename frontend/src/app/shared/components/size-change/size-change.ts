import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FileSizePipe } from '../../pipes/file-size.pipe';

/** "4.2 MB → 1.1 MB  74% smaller" */
@Component({
  selector: 'app-size-change',
  imports: [FileSizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sizes">
      {{ before() | fileSize }} <span aria-hidden="true">→&nbsp;</span><span class="visually-hidden">to </span
      ><strong>{{ after() | fileSize }}</strong>
    </span>
    @if (saved() > 0) {
      <span class="badge saved">{{ saved() }}% smaller</span>
    } @else {
      <span class="badge same">No reduction</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
    }
    .badge {
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .saved {
      background: var(--color-local-soft);
      color: var(--color-local);
    }
    .same {
      background: var(--color-surface-muted);
      color: var(--color-text-muted);
    }
  `,
})
export class SizeChange {
  readonly before = input.required<number>();
  readonly after = input.required<number>();

  protected readonly saved = computed(() => {
    const before = this.before();
    return before > 0 ? Math.max(0, Math.round((1 - this.after() / before) * 100)) : 0;
  });
}
