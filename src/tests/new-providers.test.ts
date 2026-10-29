import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmailsProvider } from '../email/providers/smails';
import { MaildropProvider } from '../email/providers/maildrop';

afterEach(() => vi.unstubAllGlobals());

describe('new temporary providers', () => {
  it('creates a smails mailbox and reads a confirmation body with its token', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ address: 'x@smails.dev', token: 'secret' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'm1', from: 'a@example.com', subject: 'Code' }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'm1', text: 'Code 123456' }) });
    vi.stubGlobal('fetch', fetch);
    const provider = new SmailsProvider();
    const mailbox = await provider.createMailbox();
    expect(mailbox.address).toBe('x@smails.dev');
    expect((await provider.getMessages(mailbox))[0].id).toBe('m1');
    expect((await provider.getMessage(mailbox, 'm1')).text).toBe('Code 123456');
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer secret');
  });

  it('creates a unique Maildrop address and fetches the full message', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { inbox: [{ id: 'm1', subject: 'Confirm', date: '2026-01-01T00:00:00Z' }] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { message: { id: 'm1', html: '<a href="https://example.com/confirm">Confirm</a>' } } }) });
    vi.stubGlobal('fetch', fetch);
    const provider = new MaildropProvider();
    const mailbox = await provider.createMailbox();
    expect(mailbox.address).toMatch(/^rma[0-9a-f]{18}@maildrop\.cc$/);
    expect((await provider.getMessages(mailbox))[0].id).toBe('m1');
    expect((await provider.getMessage(mailbox, 'm1')).html).toContain('https://example.com/confirm');
  });
});
