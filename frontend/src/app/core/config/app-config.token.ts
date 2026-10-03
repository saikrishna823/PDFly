import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AppConfig } from '../../models/app-config';

/** Injected instead of importing `environment` directly, so tests can override it. */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => environment,
});
