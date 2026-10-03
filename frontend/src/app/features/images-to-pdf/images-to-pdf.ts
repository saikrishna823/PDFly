import { ChangeDetectionStrategy, Component } from '@angular/core';

import { getTool } from '../../models/tool';
import { ImagePdfTool } from '../image-pdf/image-pdf-tool';

@Component({
  selector: 'app-images-to-pdf',
  imports: [ImagePdfTool],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-image-pdf-tool [tool]="tool" [multiple]="true" />`,
})
export class ImagesToPdf {
  protected readonly tool = getTool('images-to-pdf');
}
