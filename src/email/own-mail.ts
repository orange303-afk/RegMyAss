import { EmailMessage, Mailbox, UserSettings } from '../shared/types';
import { EmailProvider } from './provider.interface';

/** Uses an address supplied by the user. Inbox access is intentionally unavailable. */
export class OwnMailProvider implements EmailProvider {
  readonly id = 'own-mail';
  readonly name = 'Personal email (manual verification)';
  readonly capabilities = {
    createMailbox: false, readMessages: false, deleteMailbox: false,
    customDomain: true, requiresApiKey: false, supportsPush: false,
  };

  async isAvailable(): Promise<boolean> { return true; }
  async createMailbox(): Promise<Mailbox> { throw new Error('Укажите свой адрес почты в настройках.'); }

  async mailbox(settings: UserSettings): Promise<Mailbox> {
    const address = settings.ownMail?.address.trim() || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      throw new Error('Укажите действительный адрес почты в настройках.');
    }
    return { id: `manual:${address}`, address, providerId: this.id, createdAt: Date.now() };
  }

  async getMessages(_mailbox: Mailbox): Promise<EmailMessage[]> {
    throw new Error('Проверьте письмо в своей почте вручную.');
  }

  async getMessage(_mailbox: Mailbox, _messageId: string): Promise<EmailMessage> {
    throw new Error('Проверьте письмо в своей почте вручную.');
  }
}
