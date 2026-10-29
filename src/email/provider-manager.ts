/**
 * QuickPass - Provider Manager
 */

import { EmailProvider } from './provider.interface';
import { MailTmProvider } from './providers/mail-tm';
import { MailGwProvider } from './providers/mail-gw';
import { DropMailProvider } from './providers/dropmail';
import { GuerrillaMailProvider } from './providers/guerrilla';
import { OwnMailProvider } from './own-mail';
import { SmailsProvider } from './providers/smails';
import { MaildropProvider } from './providers/maildrop';
import { Mailbox, UserSettings } from '../shared/types';
import { createError } from '../shared/errors';

export class ProviderManager {
  private providers: Map<string, EmailProvider> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private lastFailureTimes: Map<string, number> = new Map();

  constructor() {
    this.registerProvider(new MailTmProvider());
    this.registerProvider(new MailGwProvider());
    this.registerProvider(new DropMailProvider());
    this.registerProvider(new GuerrillaMailProvider());
    this.registerProvider(new OwnMailProvider());
    this.registerProvider(new SmailsProvider());
    this.registerProvider(new MaildropProvider());
  }

  public registerProvider(provider: EmailProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): EmailProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): EmailProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Selects an optimal provider based on settings, availability, and error history.
   */
  public async selectProvider(
    settings: UserSettings,
    excludedProviderIds: string[] = []
  ): Promise<EmailProvider> {
    const candidates = Array.from(this.providers.values()).filter(
      (p) => settings.enabledProviders.includes(p.id) && !excludedProviderIds.includes(p.id)
    );

    if (candidates.length === 0) {
      throw createError('PROVIDER_UNAVAILABLE', 'No enabled email providers available', {
        recoverable: true,
        suggestedAction: 'switch_provider',
      });
    }

    // If manual preferred provider requested and not excluded
    if (!settings.autoSelectProvider && settings.preferredProviderId) {
      const preferred = candidates.find((p) => p.id === settings.preferredProviderId);
      if (preferred) {
        return preferred;
      }
    }

    // Sort by lowest failure count and oldest failure time
    const sorted = [...candidates].sort((a, b) => {
      const failsA = this.failureCounts.get(a.id) || 0;
      const failsB = this.failureCounts.get(b.id) || 0;
      return failsA - failsB;
    });

    for (const provider of sorted) {
      const isOk = await provider.isAvailable();
      if (isOk) {
        return provider;
      } else {
        this.recordFailure(provider.id);
      }
    }

    // If all health checks failed, try the first candidate as fallback
    return sorted[0];
  }

  /**
   * Creates a mailbox with automatic failover to alternative providers if one fails.
   */
  public async createMailboxWithFailover(settings: UserSettings): Promise<{
    mailbox: Mailbox;
    provider: EmailProvider;
  }> {
    const attemptedIds: string[] = [];
    const maxAttempts = settings.enabledProviders.length;

    while (attemptedIds.length < maxAttempts) {
      const provider = await this.selectProvider(settings, attemptedIds);
      attemptedIds.push(provider.id);

      try {
        const mailbox = await provider.createMailbox();
        this.recordSuccess(provider.id);
        return { mailbox, provider };
      } catch (err: any) {
        this.recordFailure(provider.id);
        console.warn(`Provider ${provider.id} failed to create mailbox: ${err.message}. Retrying with another...`);
      }
    }

    throw createError(
      'MAILBOX_CREATION_FAILED',
      'Failed to create a temporary mailbox with all available email providers',
      { recoverable: true, suggestedAction: 'switch_provider' }
    );
  }

  public recordSuccess(providerId: string): void {
    this.failureCounts.set(providerId, 0);
  }

  public recordFailure(providerId: string): void {
    const current = this.failureCounts.get(providerId) || 0;
    this.failureCounts.set(providerId, current + 1);
    this.lastFailureTimes.set(providerId, Date.now());
  }
}
