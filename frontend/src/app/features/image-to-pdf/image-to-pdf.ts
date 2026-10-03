import { ChangeDetectionStrategy, Component } from '@angular/core';

import { getTool } from '../../models/tool';
import { ImagePdfTool } from '../image-pdf/image-pdf-tool';

@Component({
  selector: 'app-image-to-pdf',
  imports: [ImagePdfTool],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-image-pdf-tool [tool]="tool" />`,
})
export class ImageToPdf {
  protected readonly tool = getTool('image-to-pdf');
}
