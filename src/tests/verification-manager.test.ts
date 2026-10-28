import { describe, expect, it, vi } from 'vitest';
import { VerificationManager } from '../email/verification-manager';
import { EmailProvider } from '../email/provider.interface';
import { Mailbox } from '../shared/types';

describe('VerificationManager', () => {
  it('finds a code in an older message when the newest message has none', async () => {
    const mailbox = { id: 'mailbox', address: 'test@example.com' } as Mailbox;
    const provider = {
      getMessages: vi.fn().mockResolvedValue([
        { id: 'new', subject: 'Welcome', receivedAt: 200 },
        { id: 'code', subject: 'Verification code', receivedAt: 100 },
      ]),
      getMessage: vi.fn(async (_mailbox, id) => ({
        id,
        subject: id === 'code' ? 'Verification code' : 'Welcome',
        text: id === 'code' ? 'Your verification code is 481920' : 'Hello',
        receivedAt: id === 'code' ? 100 : 200,
      })),
    } as unknown as EmailProvider;

    const result = await new VerificationManager().waitForVerification({
      mailbox,
      provider,
      startedAt: Date.now(),
      timeoutSeconds: 1,
      targetOrigin: 'https://example.com',
    });

    expect(result.verification.code).toBe('481920');
    expect(provider.getMessage).toHaveBeenCalledTimes(2);
  });

  it('ignores unrelated messages in a connected personal inbox', async () => {
    const now = Date.now();
    const mailbox = { id: 'personal', address: 'me@gmail.com' } as Mailbox;
    const provider = {
      id: 'own-mail',
      getMessages: vi.fn().mockResolvedValue([
        { id: 'other', from: 'alerts@another.com', subject: 'Verification code', text: 'Code 111111', receivedAt: now },
        { id: 'old', from: 'noreply@example.com', subject: 'Verification code', text: 'Code 222222', receivedAt: now - 120_000 },
        { id: 'target', from: 'noreply@example.com', subject: 'Verification code', text: 'Code 333333', receivedAt: now },
      ]),
      getMessage: vi.fn(async (_mailbox, id) => ({
        id, from: 'noreply@example.com', subject: 'Verification code', text: 'Code 333333', receivedAt: now,
      })),
    } as unknown as EmailProvider;

    const result = await new VerificationManager().waitForVerification({
      mailbox, provider, startedAt: now, timeoutSeconds: 1, targetOrigin: 'https://example.com',
    });

    expect(result.verification.code).toBe('333333');
    expect(provider.getMessage).toHaveBeenCalledTimes(1);
  });
});
