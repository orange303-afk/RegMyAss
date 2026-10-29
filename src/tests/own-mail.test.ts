import { describe, expect, it } from 'vitest';
import { OwnMailProvider } from '../email/own-mail';
import { DEFAULT_SETTINGS } from '../shared/constants';

describe('OwnMailProvider manual mode', () => {
  it('uses the configured address without requesting mailbox access', async () => {
    const provider = new OwnMailProvider();
    const mailbox = await provider.mailbox({
      ...DEFAULT_SETTINGS,
      ownMail: { address: ' person@proton.me ' },
    });
    expect(mailbox.address).toBe('person@proton.me');
    expect(mailbox.id).toBe('manual:person@proton.me');
    await expect(provider.getMessages(mailbox)).rejects.toThrow('Проверьте письмо');
  });

  it('rejects an invalid address', async () => {
    const provider = new OwnMailProvider();
    await expect(provider.mailbox({
      ...DEFAULT_SETTINGS,
      ownMail: { address: 'not-an-email' },
    })).rejects.toThrow('действительный адрес');
  });
});
