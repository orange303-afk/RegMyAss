import { EmailMessage, Mailbox, UserSettings } from '../shared/types';
import { EmailProvider } from './provider.interface';

const TOKEN_KEY = 'regmyass_oauth_gmail';

type GmailRecord = { address: string };

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function requestJson(url: string, token: string): Promise<any> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Ошибка Gmail API (${response.status}). Переподключите ящик в настройках.`);
  return response.json();
}

export class OwnMailProvider implements EmailProvider {
  readonly id = 'own-mail';
  readonly name = 'Собственная почта';
  readonly capabilities = {
    createMailbox: false, readMessages: true, deleteMailbox: false,
    customDomain: true, requiresApiKey: false, supportsPush: false,
  };

  async isAvailable(): Promise<boolean> { return true; }
  async createMailbox(): Promise<Mailbox> { throw new Error('Настройте собственную почту в параметрах расширения.'); }

  async connect(): Promise<string> {
    if (!chrome.runtime.getManifest().oauth2?.client_id) {
      throw new Error('В этой сборке не настроен Google OAuth. Добавьте Client ID при сборке расширения.');
    }
    let token: string;
    try {
      const result = await chrome.identity.getAuthToken({ interactive: true });
      token = result.token || '';
    } catch (error: any) {
      throw new Error(`Не удалось войти в Gmail: ${error.message || 'ошибка OAuth'}`);
    }
    if (!token) throw new Error('Google не выдал токен доступа.');
    const profile = await requestJson('https://gmail.googleapis.com/gmail/v1/users/me/profile', token);
    const address = profile.emailAddress;
    if (!address) throw new Error('Не удалось определить адрес Gmail.');
    await chrome.storage.local.set({ [TOKEN_KEY]: { address } satisfies GmailRecord });
    return address;
  }

  async disconnect(): Promise<void> {
    await chrome.identity.clearAllCachedAuthTokens();
    await chrome.storage.local.remove(TOKEN_KEY);
  }

  async getConnectedAddress(): Promise<string | null> {
    const record = (await chrome.storage.local.get(TOKEN_KEY))[TOKEN_KEY] as GmailRecord | undefined;
    return record?.address || null;
  }

  private async token(): Promise<string> {
    if (!await this.getConnectedAddress()) throw new Error('Gmail не подключён. Авторизуйте ящик в настройках.');
    try {
      const result = await chrome.identity.getAuthToken({ interactive: false });
      if (result.token) return result.token;
    } catch { /* handled below */ }
    throw new Error('Доступ к Gmail истёк. Подключите ящик снова в настройках.');
  }

  async mailbox(settings: UserSettings): Promise<Mailbox> {
    const ownMail = settings.ownMail;
    if (!ownMail) throw new Error('Выберите почтовый сервис в настройках.');
    if (ownMail.service === 'proton') {
      const address = ownMail.address.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        throw new Error('Укажите действительный адрес Proton Mail в настройках.');
      }
      return { id: `proton:${address}`, address, providerId: this.id, createdAt: Date.now() };
    }
    const address = await this.getConnectedAddress();
    if (!address || address !== ownMail.address) throw new Error('Подключите выбранный Gmail через OAuth в настройках.');
    await this.token();
    return { id: address, address, providerId: this.id, createdAt: Date.now() };
  }

  async getMessages(mailbox: Mailbox): Promise<EmailMessage[]> {
    if (this.isProton(mailbox)) throw new Error('Откройте Proton Mail в браузере и проверьте письмо вручную.');
    const token = await this.token();
    const list = await requestJson('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25', token);
    return Promise.all((list.messages || []).map((item: { id: string }) => this.getMessage(mailbox, item.id)));
  }

  async getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage> {
    if (this.isProton(mailbox)) throw new Error('Письма Proton Mail открываются в браузере.');
    const token = await this.token();
    const msg = await requestJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`, token);
    const headers = Object.fromEntries((msg.payload?.headers || []).map((h: any) => [String(h.name).toLowerCase(), h.value]));
    const parts: any[] = [];
    const visit = (part: any) => { parts.push(part); for (const child of part.parts || []) visit(child); };
    visit(msg.payload || {});
    const text = parts.find((p) => p.mimeType === 'text/plain' && p.body?.data);
    const html = parts.find((p) => p.mimeType === 'text/html' && p.body?.data);
    return {
      id: msg.id, from: headers.from || '', to: headers.to || mailbox.address,
      subject: headers.subject || '', receivedAt: Number(msg.internalDate) || Date.now(),
      text: text ? decodeBase64Url(text.body.data) : undefined,
      html: html ? decodeBase64Url(html.body.data) : undefined,
    };
  }

  private isProton(mailbox: Mailbox): boolean {
    return mailbox.id.startsWith('proton:');
  }
}
