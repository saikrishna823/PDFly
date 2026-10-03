export interface AppConfig {
  production: boolean;
  /** Base URL of the FastAPI service, without a trailing slash. */
  apiBaseUrl: string;
  /** Upload limit for server-side tools; keep in sync with the backend's MAX_UPLOAD_MB. */
  maxUploadMb: number;
  /** Limit for files processed in the browser (memory-bound, not network-bound). */
  maxLocalFileMb: number;
  repositoryUrl: string;
}
