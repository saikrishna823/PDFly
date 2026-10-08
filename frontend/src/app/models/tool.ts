import { IconName } from '../shared/components/icon/icons';

/** Where a tool's processing happens. Drives every privacy message in the UI. */
export type ProcessingLocation = 'local' | 'server';

export type ToolId =
  | 'image-to-pdf'
  | 'images-to-pdf'
  | 'pdf-to-image'
  | 'compress-pdf'
  | 'compress-image'
  | 'word-to-pdf'
  | 'pdf-to-word';

export interface ToolDefinition {
  id: ToolId;
  /** Route path, relative to the app root. */
  path: string;
  title: string;
  /** Short label for cards, e.g. "Image → PDF". */
  shortTitle: string;
  description: string;
  icon: IconName;
  processing: ProcessingLocation;
  status: 'available' | 'coming-soon';
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'image-to-pdf',
    path: 'image-to-pdf',
    title: 'Image to PDF',
    shortTitle: 'Image → PDF',
    description: 'Turn a JPG, PNG or WebP image into a PDF page.',
    icon: 'image',
    processing: 'local',
    status: 'available',
  },
  {
    id: 'images-to-pdf',
    path: 'images-to-pdf',
    title: 'Images to PDF',
    shortTitle: 'Images → PDF',
    description: 'Combine several images into one PDF, in the order you choose.',
    icon: 'images',
    processing: 'local',
    status: 'available',
  },
  {
    id: 'pdf-to-image',
    path: 'pdf-to-image',
    title: 'PDF to Image',
    shortTitle: 'PDF → Image',
    description: 'Save PDF pages as PNG or JPEG images.',
    icon: 'file-image',
    processing: 'local',
    status: 'available',
  },
  {
    id: 'compress-pdf',
    path: 'compress-pdf',
    title: 'Compress PDF',
    shortTitle: 'Compress PDF',
    description: 'Make a PDF smaller by optimizing the photos and scans inside it.',
    icon: 'file-down',
    processing: 'local',
    status: 'available',
  },
  {
    id: 'compress-image',
    path: 'compress-image',
    title: 'Compress Image',
    shortTitle: 'Compress Image',
    description: 'Shrink JPG, PNG or WebP images, or fit them under a size you choose.',
    icon: 'compress',
    processing: 'local',
    status: 'available',
  },
  {
    id: 'word-to-pdf',
    path: 'word-to-pdf',
    title: 'Word to PDF',
    shortTitle: 'Word → PDF',
    description: 'Convert DOCX documents to PDF, keeping their formatting.',
    icon: 'file-text',
    processing: 'server',
    status: 'coming-soon',
  },
  {
    id: 'pdf-to-word',
    path: 'pdf-to-word',
    title: 'PDF to Word',
    shortTitle: 'PDF → Word',
    description: 'Create an editable DOCX file from a PDF.',
    icon: 'file-edit',
    processing: 'server',
    status: 'coming-soon',
  },
];

export function getTool(id: ToolId): ToolDefinition {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) {
    throw new Error(`Unknown tool: ${id}`);
  }
  return tool;
}
