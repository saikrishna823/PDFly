import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, filter, from, map, switchMap, throwError } from 'rxjs';

import { APP_CONFIG } from '../core/config/app-config.token';
import { ApiError } from '../models/api-error';

/** Progress of an upload-and-convert request. */
export type TransferEvent =
  | { type: 'uploading'; percent: number | null }
  | { type: 'processing' }
  | { type: 'complete'; blob: Blob };

const GENERIC_MESSAGE = 'Something went wrong while processing your file. Please try again.';

/** Thin HttpClient wrapper for the PDFly API: multipart in, binary file out, friendly errors. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  postForFile(path: string, body: FormData): Observable<TransferEvent> {
    const url = `${this.config.apiBaseUrl.replace(/\/+$/, '')}${path}`;
    return this.http
      .post(url, body, { observe: 'events', reportProgress: true, responseType: 'blob' })
      .pipe(
        map(toTransferEvent),
        filter((event): event is TransferEvent => event !== null),
        catchError((error: unknown) => from(toApiError(error)).pipe(switchMap((e) => throwError(() => e)))),
      );
  }
}

function toTransferEvent(event: HttpEvent<Blob>): TransferEvent | null {
  switch (event.type) {
    case HttpEventType.Sent:
      return { type: 'uploading', percent: 0 };
    case HttpEventType.UploadProgress: {
      if (!event.total) return { type: 'uploading', percent: null };
      const percent = Math.round((event.loaded / event.total) * 100);
      return percent >= 100 ? { type: 'processing' } : { type: 'uploading', percent };
    }
    case HttpEventType.Response:
      return event.body ? { type: 'complete', blob: event.body } : null;
    default:
      return null;
  }
}

export async function toApiError(error: unknown): Promise<ApiError> {
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError('unknown_error', GENERIC_MESSAGE, -1);
  }
  if (error.status === 0) {
    return new ApiError(
      'network_error',
      "We couldn't reach the PDFly service. Check your internet connection and try again.",
      0,
    );
  }

  const body = await readErrorBody(error.error);
  if (body) {
    return new ApiError(body.code, body.message, error.status);
  }
  return new ApiError('http_error', fallbackMessage(error.status), error.status);
}

async function readErrorBody(raw: unknown): Promise<{ code: string; message: string } | null> {
  try {
    const parsed: unknown = raw instanceof Blob ? JSON.parse(await raw.text()) : raw;
    const detail = (parsed as { error?: { code?: unknown; message?: unknown } } | null)?.error;
    if (typeof detail?.code === 'string' && typeof detail.message === 'string') {
      return { code: detail.code, message: detail.message };
    }
  } catch {
    // Not our JSON error format (e.g. an HTML page from a proxy).
  }
  return null;
}

function fallbackMessage(status: number): string {
  if (status === 413) return 'This file is too large to process.';
  if (status === 429) return "You've made a lot of requests in a short time. Please wait a minute and try again.";
  if (status >= 500) return 'The conversion service is having trouble right now. Please try again in a moment.';
  return GENERIC_MESSAGE;
}
