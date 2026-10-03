import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import {
  DEFAULT_IMAGE_PDF_OPTIONS,
  FIT_CHOICES,
  ImagePdfOptions,
  MARGIN_CHOICES,
  ORIENTATION_CHOICES,
  PAGE_SIZE_CHOICES,
} from '../../models/image-pdf-options';

export type ImagePdfOptionsForm = { [K in keyof ImagePdfOptions]: FormControl<ImagePdfOptions[K]> };

export function createImagePdfOptionsForm(fb: NonNullableFormBuilder): FormGroup<ImagePdfOptionsForm> {
  const d = DEFAULT_IMAGE_PDF_OPTIONS;
  return fb.group({
    pageSize: fb.control(d.pageSize),
    orientation: fb.control(d.orientation),
    fit: fb.control(d.fit),
    margin: fb.control(d.margin),
  });
}

@Component({
  selector: 'app-image-pdf-settings',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset [formGroup]="form()">
      <legend>Page settings</legend>

      <div class="field">
        <label class="field-label" for="opt-page-size">Page size</label>
        <select id="opt-page-size" class="select" formControlName="pageSize">
          @for (choice of pageSizes; track choice.value) {
            <option [value]="choice.value">{{ choice.label }}</option>
          }
        </select>
      </div>

      <div class="field">
        <label class="field-label" for="opt-orientation">Orientation</label>
        <select id="opt-orientation" class="select" formControlName="orientation" [attr.aria-describedby]="usesImageSize() ? 'opt-image-hint' : null">
          @for (choice of orientations; track choice.value) {
            <option [value]="choice.value">{{ choice.label }}</option>
          }
        </select>
      </div>

      <div class="field">
        <label class="field-label" for="opt-fit">Image fit</label>
        <select id="opt-fit" class="select" formControlName="fit" [attr.aria-describedby]="usesImageSize() ? 'opt-image-hint' : null">
          @for (choice of fits; track choice.value) {
            <option [value]="choice.value">{{ choice.label }}</option>
          }
        </select>
      </div>

      @if (usesImageSize()) {
        <p id="opt-image-hint" class="field-hint">Each page matches its image, so orientation and fit don't apply.</p>
      }

      <div class="field">
        <label class="field-label" for="opt-margin">Margins</label>
        <select id="opt-margin" class="select" formControlName="margin">
          @for (choice of margins; track choice.value) {
            <option [value]="choice.value">{{ choice.label }}</option>
          }
        </select>
      </div>
    </fieldset>
  `,
  styles: `
    fieldset {
      display: grid;
      gap: 16px;
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
    }
    legend {
      padding: 0;
      margin-bottom: 4px;
      font-size: 1.1rem;
      font-weight: 650;
    }
  `,
})
export class ImagePdfSettings {
  readonly form = input.required<FormGroup<ImagePdfOptionsForm>>();

  protected readonly pageSizes = PAGE_SIZE_CHOICES;

  protected usesImageSize(): boolean {
    return this.form().controls.pageSize.value === 'image';
  }
  protected readonly orientations = ORIENTATION_CHOICES;
  protected readonly fits = FIT_CHOICES;
  protected readonly margins = MARGIN_CHOICES;
}
