import { EmailMessage, EmailProviderCapabilities, Mailbox } from '../../shared/types';
import { EmailProvider } from '../provider.interface';

const BASE = 'https://smails.dev/api/mailbox';

async function json(response: Response): Promise<any> {
  if (!response.ok) throw new Error(`smails HTTP ${response.status}`);
  return response.json();
}

export class SmailsProvider implements EmailProvider {
  readonly id = 'smails';
  readonly name = 'smails';
  readonly capabilities: EmailProviderCapabilities = {
    createMailbox: true, readMessages: true, deleteMailbox: false,
    customDomain: false, requiresApiKey: false, supportsPush: false,
  };

  async isAvailable(): Promise<boolean> {
    try { return (await fetch('https://smails.dev/email-api', { method: 'HEAD' })).ok; }
    catch { return false; }
  }

  async createMailbox(): Promise<Mailbox> {
    const data = await json(await fetch(BASE, { method: 'POST' }));
    if (!data.address || !data.token) throw new Error('Invalid smails mailbox response');
    return { id: data.address, address: data.address, token: data.token,
      providerId: this.id, createdAt: Date.now() };
  }

  private headers(mailbox: Mailbox): HeadersInit {
    if (!mailbox.token) throw new Error('Missing smails mailbox token');
    return { Authorization: `Bearer ${mailbox.token}` };
  }

  private normalize(item: any, mailbox: Mailbox): EmailMessage {
    return {
      id: String(item.id), from: item.from || item.sender || '',
      to: item.to || mailbox.address, subject: item.subject || '',
      text: item.text || item.body || '', html: item.html || '',
      receivedAt: item.receivedAt ? new Date(item.receivedAt).getTime() : Date.now(),
    };
  }

  async getMessages(mailbox: Mailbox): Promise<EmailMessage[]> {
    const data = await json(await fetch(`${BASE}/messages`, { headers: this.headers(mailbox) }));
    const items = Array.isArray(data) ? data : data.messages;
    if (!Array.isArray(items)) throw new Error('Invalid smails messages response');
    return items.map((item: any) => this.normalize(item, mailbox));
  }

  async getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage> {
    const data = await json(await fetch(`${BASE}/messages/${encodeURIComponent(messageId)}`, { headers: this.headers(mailbox) }));
    return this.normalize(data.message || data, mailbox);
  }
}
