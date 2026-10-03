import { AppConfig } from '../app/models/app-config';

// Development build (`ng serve`).
export const environment: AppConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
  maxUploadMb: 25,
  maxLocalFileMb: 100,
  repositoryUrl: 'https://github.com/saikrishna823/PDFly',
};
