import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PageLayout, previewGeometry } from '../../services/page-layout';

/** Scaled drawing of one PDF page, using the same layout maths as the PDF writer. */
@Component({
  selector: 'app-page-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    <div
      class="page"
      [style.aspect-ratio]="g.aspectRatio"
      [style.width]="portrait() ? 'auto' : '100%'"
      [style.height]="portrait() ? '100%' : 'auto'"
    >
      <div
        class="content"
        [style.left.%]="g.content.left"
        [style.top.%]="g.content.top"
        [style.width.%]="g.content.width"
        [style.height.%]="g.content.height"
      >
        <img
          [src]="src()"
          [alt]="alt()"
          draggable="false"
          [style.left.%]="g.image.left"
          [style.top.%]="g.image.top"
          [style.width.%]="g.image.width"
          [style.height.%]="g.image.height"
          [style.transform]="'rotate(' + g.rotation + 'deg)'"
        />
      </div>
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
    }
    .page {
      position: absolute;
      inset: 0;
      margin: auto;
      max-width: 100%;
      max-height: 100%;
      background: var(--page-preview-bg);
      box-shadow: var(--shadow-md);
      border-radius: 2px;
    }
    .content {
      position: absolute;
      overflow: hidden;
    }
    img {
      position: absolute;
      max-width: none;
      object-fit: fill;
      transform-origin: center;
    }
  `,
})
export class PagePreview {
  readonly src = input.required<string>();
  readonly alt = input('');
  readonly layout = input.required<PageLayout>();

  protected readonly geometry = computed(() => previewGeometry(this.layout()));
  protected readonly portrait = computed(() => this.layout().pageHeight >= this.layout().pageWidth);
}
