import { AppConfig } from '../app/models/app-config';

// Production build (`ng build`). Point apiBaseUrl at your deployed FastAPI service.
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: 'https://api.example.com',
  maxUploadMb: 25,
  maxLocalFileMb: 100,
  repositoryUrl: 'https://github.com/saikrishna823/PDFly',
};
