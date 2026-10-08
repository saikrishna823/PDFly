import { Routes } from '@angular/router';

import { Home } from './features/home/home';

// Each tool is lazy-loaded so its processing libraries (e.g. pdf-lib) are only
// downloaded when that tool is opened.
export const routes: Routes = [
  { path: '', component: Home, title: 'PDFly — Private PDF Tools' },
  {
    path: 'image-to-pdf',
    loadComponent: () => import('./features/image-to-pdf/image-to-pdf').then((m) => m.ImageToPdf),
    title: 'Image to PDF · PDFly',
  },
  {
    path: 'images-to-pdf',
    loadComponent: () => import('./features/images-to-pdf/images-to-pdf').then((m) => m.ImagesToPdf),
    title: 'Images to PDF · PDFly',
  },
  {
    path: 'pdf-to-image',
    loadComponent: () => import('./features/pdf-to-image/pdf-to-image').then((m) => m.PdfToImage),
    title: 'PDF to Image · PDFly',
  },
  {
    path: 'compress-pdf',
    loadComponent: () => import('./features/compress-pdf/compress-pdf').then((m) => m.CompressPdf),
    title: 'Compress PDF · PDFly',
  },
  {
    path: 'compress-image',
    loadComponent: () => import('./features/compress-image/compress-image').then((m) => m.CompressImage),
    title: 'Compress Image · PDFly',
  },
  { path: '**', redirectTo: '' },
];
