import { describe, expect, it } from 'vitest';
import { OwnMailProvider } from '../email/own-mail';
import { DEFAULT_SETTINGS } from '../shared/constants';

describe('OwnMailProvider Proton mode', () => {
  it('uses the configured address without requesting mailbox access', async () => {
    const provider = new OwnMailProvider();
    const mailbox = await provider.mailbox({
      ...DEFAULT_SETTINGS,
      ownMail: { service: 'proton', address: ' person@proton.me ' },
    });
    expect(mailbox.address).toBe('person@proton.me');
    expect(mailbox.id).toBe('proton:person@proton.me');
    await expect(provider.getMessages(mailbox)).rejects.toThrow('Откройте Proton Mail');
  });

  it('rejects an invalid address', async () => {
    const provider = new OwnMailProvider();
    await expect(provider.mailbox({
      ...DEFAULT_SETTINGS,
      ownMail: { service: 'proton', address: 'not-an-email' },
    })).rejects.toThrow('действительный адрес');
  });
});
