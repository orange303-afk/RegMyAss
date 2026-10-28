/**
 * QuickPass - Mail.tm Email Provider
 * API Docs: https://docs.mail.tm/
 */

import { EmailMessage, EmailProviderCapabilities, Mailbox } from '../../shared/types';
import { EmailProvider } from '../provider.interface';
import { createError } from '../../shared/errors';

export class MailTmProvider implements EmailProvider {
  public readonly id: string = 'mail-tm';
  public readonly name: string = 'Mail.tm';
  protected readonly baseUrl: string;

  public readonly capabilities: EmailProviderCapabilities = {
    createMailbox: true,
    readMessages: true,
    deleteMailbox: true,
    customDomain: false,
    requiresApiKey: false,
    supportsPush: false,
  };

  constructor(baseUrl: string = 'https://api.mail.tm') {
    this.baseUrl = baseUrl;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/domains?page=1`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async createMailbox(): Promise<Mailbox> {
    try {
      // 1. Get available domains
      const domainsRes = await fetch(`${this.baseUrl}/domains?page=1`, {
        headers: { Accept: 'application/json' },
      });

      if (!domainsRes.ok) {
        throw createError('PROVIDER_UNAVAILABLE', `Mail.tm domains error: ${domainsRes.status}`, {
          recoverable: true,
        });
      }

      const domainsData = await domainsRes.json();
      const domains = Array.isArray(domainsData) ? domainsData : (domainsData['hydra:member'] || []);
      if (!domains.length) {
        throw createError('MAILBOX_CREATION_FAILED', 'No available domains on Mail.tm');
      }

      const domain = domains[0].domain;
      const username = `qp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const address = `${username}@${domain}`;
      const password = `P@ss_${Math.random().toString(36).substring(2, 10)}!${Date.now()}`;

      // 2. Create account
      const createRes = await fetch(`${this.baseUrl}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw createError('MAILBOX_CREATION_FAILED', `Failed to create mailbox on Mail.tm: ${errText}`);
      }

      const accountData = await createRes.json();

      // 3. Acquire auth token
      const tokenRes = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
      });

      if (!tokenRes.ok) {
        throw createError('MAILBOX_CREATION_FAILED', 'Failed to authenticate with created mailbox');
      }

      const tokenData = await tokenRes.json();

      return {
        id: accountData.id || address,
        address,
        token: tokenData.token,
        password,
        createdAt: Date.now(),
        providerId: this.id,
      };
    } catch (err: any) {
      if (err.name === 'QuickPassError') throw err;
      throw createError('MAILBOX_CREATION_FAILED', `Mail.tm creation failed: ${err.message}`, {
        recoverable: true,
      });
    }
  }

  public async getMessages(mailbox: Mailbox): Promise<EmailMessage[]> {
    if (!mailbox.token) {
      throw createError('PROVIDER_UNAVAILABLE', 'Mailbox token missing');
    }

    const res = await fetch(`${this.baseUrl}/messages?page=1`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${mailbox.token}`,
      },
    });

    if (res.status === 429) {
      throw createError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded on Mail.tm', { recoverable: true });
    }

    if (!res.ok) {
      throw createError('PROVIDER_UNAVAILABLE', `Failed to fetch messages: ${res.status}`);
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : (data['hydra:member'] || []);

    return items.map((item: any) => ({
      id: item.id,
      from: item.from?.address || item.from?.name || 'unknown',
      to: mailbox.address,
      subject: item.subject || '(No subject)',
      text: item.intro || '',
      receivedAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
    }));
  }

  public async getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage> {
    if (!mailbox.token) {
      throw createError('PROVIDER_UNAVAILABLE', 'Mailbox token missing');
    }

    const res = await fetch(`${this.baseUrl}/messages/${encodeURIComponent(messageId)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${mailbox.token}`,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      throw createError('PROVIDER_UNAVAILABLE', `Failed to read message: ${res.status}`);
    }

    const item = await res.json();

    return {
      id: item.id,
      from: item.from?.address || 'unknown',
      to: mailbox.address,
      subject: item.subject || '',
      text: item.text || '',
      html: Array.isArray(item.html) ? item.html.join('') : item.html || '',
      receivedAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
    };
  }

  public async deleteMailbox(mailbox: Mailbox): Promise<void> {
    if (!mailbox.token || !mailbox.id) return;
    try {
      await fetch(`${this.baseUrl}/accounts/${mailbox.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${mailbox.token}`,
        },
      });
    } catch {
      // Ignore deletion errors on temp mailboxes
    }
  }
}
