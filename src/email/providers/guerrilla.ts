/**
 * QuickPass - Guerrilla Mail Email Provider
 * API Docs: https://www.guerrillamail.com/GuerrillaMailAPI.html
 */

import { EmailMessage, EmailProviderCapabilities, Mailbox } from '../../shared/types';
import { EmailProvider } from '../provider.interface';
import { createError } from '../../shared/errors';

export class GuerrillaMailProvider implements EmailProvider {
  public readonly id = 'guerrilla';
  public readonly name = 'Guerrilla Mail';
  private readonly baseUrl = 'https://api.guerrillamail.com/ajax.php';

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
      const res = await fetch(`${this.baseUrl}?f=get_email_address&lang=en`);
      return res.ok;
    } catch {
      return false;
    }
  }

  public async createMailbox(): Promise<Mailbox> {
    try {
      const res = await fetch(`${this.baseUrl}?f=get_email_address&lang=en`);
      if (!res.ok) {
        throw createError('PROVIDER_UNAVAILABLE', `Guerrilla Mail error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.email_addr || !data.sid_token) {
        throw createError('MAILBOX_CREATION_FAILED', 'Invalid Guerrilla Mail response');
      }

      return {
        id: data.sid_token,
        address: data.email_addr,
        token: data.sid_token,
        createdAt: data.email_timestamp ? data.email_timestamp * 1000 : Date.now(),
        providerId: this.id,
      };
    } catch (err: any) {
      if (err.name === 'QuickPassError') throw err;
      throw createError('MAILBOX_CREATION_FAILED', `Guerrilla Mail creation failed: ${err.message}`, {
        recoverable: true,
      });
    }
  }

  public async getMessages(mailbox: Mailbox): Promise<EmailMessage[]> {
    if (!mailbox.token) {
      throw createError('PROVIDER_UNAVAILABLE', 'Guerrilla sid_token missing');
    }

    try {
      const res = await fetch(`${this.baseUrl}?f=check_email&seq=0&sid_token=${encodeURIComponent(mailbox.token)}`);
      if (!res.ok) {
        throw createError('PROVIDER_UNAVAILABLE', `Guerrilla check_email error: ${res.status}`);
      }

      const data = await res.json();
      const list = data.list || [];

      // Filter out Guerrilla's welcome email
      const validMessages = list.filter((item: any) => item.mail_from !== 'no-reply@guerrillamail.com');

      return validMessages.map((item: any) => ({
        id: String(item.mail_id),
        from: item.mail_from || 'unknown',
        to: mailbox.address,
        subject: item.mail_subject || '',
        text: item.mail_excerpt || '',
        receivedAt: item.mail_timestamp ? Number(item.mail_timestamp) * 1000 : Date.now(),
      }));
    } catch (err: any) {
      if (err.name === 'QuickPassError') throw err;
      throw createError('PROVIDER_UNAVAILABLE', `Failed to check Guerrilla emails: ${err.message}`);
    }
  }

  public async getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage> {
    if (!mailbox.token) {
      throw createError('PROVIDER_UNAVAILABLE', 'Guerrilla sid_token missing');
    }

    try {
      const res = await fetch(
        `${this.baseUrl}?f=fetch_email&email_id=${encodeURIComponent(messageId)}&sid_token=${encodeURIComponent(
          mailbox.token
        )}`
      );

      if (!res.ok) {
        throw createError('PROVIDER_UNAVAILABLE', `Guerrilla fetch_email error: ${res.status}`);
      }

      const item = await res.json();

      return {
        id: String(item.mail_id),
        from: item.mail_from || 'unknown',
        to: mailbox.address,
        subject: item.mail_subject || '',
        text: item.mail_body || '',
        html: item.mail_body || '',
        receivedAt: item.mail_timestamp ? Number(item.mail_timestamp) * 1000 : Date.now(),
      };
    } catch (err: any) {
      if (err.name === 'QuickPassError') throw err;
      throw createError('PROVIDER_UNAVAILABLE', `Failed to fetch Guerrilla email: ${err.message}`);
    }
  }
}
