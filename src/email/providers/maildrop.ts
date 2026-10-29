import { EmailMessage, EmailProviderCapabilities, Mailbox } from '../../shared/types';
import { EmailProvider } from '../provider.interface';

const ENDPOINT = 'https://api.maildrop.cc/graphql';

export class MaildropProvider implements EmailProvider {
  readonly id = 'maildrop';
  readonly name = 'Maildrop';
  readonly capabilities: EmailProviderCapabilities = {
    createMailbox: true, readMessages: true, deleteMailbox: false,
    customDomain: false, requiresApiKey: false, supportsPush: false,
  };

  private async query(query: string, variables: Record<string, string> = {}): Promise<any> {
    const response = await fetch(ENDPOINT, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    if (!response.ok) throw new Error(`Maildrop HTTP ${response.status}`);
    const data = await response.json();
    if (data.errors?.length) throw new Error(data.errors[0].message || 'Maildrop GraphQL error');
    return data.data;
  }

  async isAvailable(): Promise<boolean> {
    try { return Boolean((await this.query('query { ping(message: "ok") }')).ping); }
    catch { return false; }
  }

  async createMailbox(): Promise<Mailbox> {
    const local = `rma${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    return { id: local, address: `${local}@maildrop.cc`, providerId: this.id, createdAt: Date.now() };
  }

  private normalize(item: any, mailbox: Mailbox): EmailMessage {
    return { id: String(item.id), from: item.headerfrom || item.mailfrom || '',
      to: mailbox.address, subject: item.subject || '', text: item.data || '',
      html: item.html || '', receivedAt: item.date ? new Date(item.date).getTime() : Date.now() };
  }

  async getMessages(mailbox: Mailbox): Promise<EmailMessage[]> {
    const data = await this.query('query($mailbox: String!) { inbox(mailbox: $mailbox) { id headerfrom subject date } }', { mailbox: mailbox.id });
    return (data.inbox || []).map((item: any) => this.normalize(item, mailbox));
  }

  async getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage> {
    const data = await this.query('query($mailbox: String!, $id: String!) { message(mailbox: $mailbox, id: $id) { id headerfrom mailfrom subject date data html } }', { mailbox: mailbox.id, id: messageId });
    if (!data.message) throw new Error('Maildrop message not found');
    return this.normalize(data.message, mailbox);
  }
}
