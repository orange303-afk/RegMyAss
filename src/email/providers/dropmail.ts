/**
 * QuickPass - DropMail.me Email Provider
 * API Docs: https://dropmail.me/api/
 */

import { EmailMessage, EmailProviderCapabilities, Mailbox } from '../../shared/types';
import { EmailProvider } from '../provider.interface';
import { createError } from '../../shared/errors';

export class DropMailProvider implements EmailProvider {
  public readonly id = 'dropmail';
  public readonly name = 'DropMail.me';
  private readonly endpoint = 'https://dropmail.me/api/graphql/quickpass_v1';

  public readonly capabilities: EmailProviderCapabilities = {
    createMailbox: true,
    readMessages: true,
    deleteMailbox: false,
    customDomain: false,
    requiresApiKey: false,
    supportsPush: false,
  };

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'query { __typename }',
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async createMailbox(): Promise<Mailbox> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              introduceSession {
                id
                expiresAt
                addresses {
                  address
                }
              }
            }
          `,
        }),
      });

      if (!res.ok) {
        throw createError('PROVIDER_UNAVAILABLE', `DropMail HTTP error: ${res.status}`);
      }

      const data = await res.json();
      const session = data?.data?.introduceSession;
      if (!session || !session.addresses?.length) {
        throw createError('MAILBOX_CREATION_FAILED', 'Invalid response from DropMail API');
      }

      const address = session.addresses[0].address;

      return {
        id: session.id,
        address,
        token: session.id,
        createdAt: Date.now(),
        expiresAt: session.expiresAt ? new Date(session.expiresAt).getTime() : undefined,
        providerId: this.id,
      };
    } catch (err: any) {
      if (err.name === 'QuickPassError') throw err;
      throw createError('MAILBOX_CREATION_FAILED', `DropMail creation failed: ${err.message}`, {
        recoverable: true,
      });
    }
  }

  public async getMessages(mailbox: Mailbox): Promise<EmailMessage[]> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query($id: ID!) {
              session(id: $id) {
                mails {
                  id
                  fromAddr
                  toAddr
                  receivedAt
                  subject
                  text
                  html
                }
              }
            }
          `,
          variables: { id: mailbox.id },
        }),
      });

      if (!res.ok) {
        throw createError('PROVIDER_UNAVAILABLE', `DropMail fetch error: ${res.status}`);
      }

      const json = await res.json();
      const mails = json?.data?.session?.mails || [];

      return mails.map((m: any) => ({
        id: m.id,
        from: m.fromAddr || 'unknown',
        to: m.toAddr || mailbox.address,
        subject: m.subject || '',
        text: m.text || '',
        html: m.html || '',
        receivedAt: m.receivedAt ? new Date(m.receivedAt).getTime() : Date.now(),
      }));
    } catch (err: any) {
      if (err.name === 'QuickPassError') throw err;
      throw createError('PROVIDER_UNAVAILABLE', `Failed to get DropMail messages: ${err.message}`);
    }
  }

  public async getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage> {
    const messages = await this.getMessages(mailbox);
    const found = messages.find((m) => m.id === messageId);
    if (!found) {
      throw createError('EMAIL_TIMEOUT', `Message ${messageId} not found in DropMail mailbox`);
    }
    return found;
  }
}
