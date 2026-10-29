import { describe, expect, it } from 'vitest';
import { buildFailureReportUrl } from '../shared/report';
import { ActiveProcess } from '../shared/types';

describe('failure report draft', () => {
  it('includes only safe diagnostic fields and omits account data', () => {
    const process = {
      origin: 'https://example.com/register?email=private@example.com',
      providerId: 'smails',
      failedAtState: 'awaiting_email',
      lastErrorCode: 'EMAIL_TIMEOUT',
      lastError: 'Password secret123 and code 123456',
      accountData: { email: 'private@example.com', password: 'secret123' },
      mailbox: { address: 'private@example.com', token: 'mailbox-token' },
    } as ActiveProcess;
    const url = new URL(buildFailureReportUrl(process, '1.2.0'));
    expect(url.hostname).toBe('github.com');
    expect(url.searchParams.get('title')).toBe('Registration failed on example.com');
    const body = url.searchParams.get('body') || '';
    expect(body).toContain('EMAIL_TIMEOUT');
    expect(body).toContain('awaiting_email');
    for (const secret of ['private@example.com', 'secret123', '123456', 'mailbox-token', '/register?']) {
      expect(body).not.toContain(secret);
    }
  });
});
