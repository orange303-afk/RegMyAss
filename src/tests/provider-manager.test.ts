import { describe, it, expect, vi } from 'vitest';
import { ProviderManager } from '../email/provider-manager';
import { EmailProvider } from '../email/provider.interface';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { Mailbox } from '../shared/types';

describe('ProviderManager', () => {
  it('registers temporary and manual providers by default', () => {
    const manager = new ProviderManager();
    const providers = manager.getAllProviders();
    expect(providers.length).toBeGreaterThanOrEqual(4);
    expect(manager.getProvider('mail-tm')).toBeDefined();
    expect(manager.getProvider('mail-gw')).toBeDefined();
    expect(manager.getProvider('dropmail')).toBeDefined();
    expect(manager.getProvider('guerrilla')).toBeDefined();
    expect(manager.getProvider('smails')).toBeDefined();
    expect(manager.getProvider('maildrop')).toBeDefined();
    expect(manager.getProvider('own-mail')).toBeDefined();
  });

  it('selects preferred provider when auto-select is disabled', async () => {
    const manager = new ProviderManager();
    const mockProvider: EmailProvider = {
      id: 'custom-prov',
      name: 'Custom',
      capabilities: {
        createMailbox: true,
        readMessages: true,
        deleteMailbox: false,
        customDomain: false,
        requiresApiKey: false,
        supportsPush: false,
      },
      isAvailable: vi.fn().mockResolvedValue(true),
      createMailbox: vi.fn(),
      getMessages: vi.fn(),
      getMessage: vi.fn(),
    };
    manager.registerProvider(mockProvider);

    const settings = {
      ...DEFAULT_SETTINGS,
      autoSelectProvider: false,
      preferredProviderId: 'custom-prov',
      enabledProviders: ['custom-prov'],
    };

    const selected = await manager.selectProvider(settings);
    expect(selected.id).toBe('custom-prov');
  });

  it('fails over to secondary provider if first provider fails', async () => {
    const manager = new ProviderManager();

    const failingProvider: EmailProvider = {
      id: 'failing-prov',
      name: 'Failing',
      capabilities: {
        createMailbox: true,
        readMessages: true,
        deleteMailbox: false,
        customDomain: false,
        requiresApiKey: false,
        supportsPush: false,
      },
      isAvailable: vi.fn().mockResolvedValue(true),
      createMailbox: vi.fn().mockRejectedValue(new Error('Network down')),
      getMessages: vi.fn(),
      getMessage: vi.fn(),
    };

    const workingMailbox: Mailbox = {
      id: 'mb_123',
      address: 'working@test.com',
      createdAt: Date.now(),
      providerId: 'working-prov',
    };

    const workingProvider: EmailProvider = {
      id: 'working-prov',
      name: 'Working',
      capabilities: {
        createMailbox: true,
        readMessages: true,
        deleteMailbox: false,
        customDomain: false,
        requiresApiKey: false,
        supportsPush: false,
      },
      isAvailable: vi.fn().mockResolvedValue(true),
      createMailbox: vi.fn().mockResolvedValue(workingMailbox),
      getMessages: vi.fn(),
      getMessage: vi.fn(),
    };

    manager.registerProvider(failingProvider);
    manager.registerProvider(workingProvider);

    const settings = {
      ...DEFAULT_SETTINGS,
      autoSelectProvider: true,
      enabledProviders: ['failing-prov', 'working-prov'],
    };

    const result = await manager.createMailboxWithFailover(settings);
    expect(result.provider.id).toBe('working-prov');
    expect(result.mailbox.address).toBe('working@test.com');
  });
});
