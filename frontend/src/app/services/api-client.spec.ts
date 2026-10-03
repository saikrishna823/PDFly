import { HttpErrorResponse } from '@angular/common/http';

import { toApiError } from './api-client';

describe('toApiError', () => {
  it('uses the server error message from a Blob body', async () => {
    const body = new Blob([JSON.stringify({ error: { code: 'invalid_file', message: "We couldn't read this file." } })]);
    const error = await toApiError(new HttpErrorResponse({ status: 422, error: body }));

    expect(error.code).toBe('invalid_file');
    expect(error.message).toBe("We couldn't read this file.");
    expect(error.status).toBe(422);
  });

  it('explains network failures', async () => {
    const error = await toApiError(new HttpErrorResponse({ status: 0 }));
    expect(error.code).toBe('network_error');
    expect(error.message).toContain("couldn't reach");
  });

  it('falls back to a friendly message for unknown bodies', async () => {
    const error = await toApiError(new HttpErrorResponse({ status: 502, error: new Blob(['<html>Bad gateway</html>']) }));
    expect(error.code).toBe('http_error');
    expect(error.message).not.toContain('html');
  });

  it('handles non-HTTP errors', async () => {
    const error = await toApiError(new TypeError('boom'));
    expect(error.code).toBe('unknown_error');
    expect(error.message).not.toContain('boom');
  });
});
