/**
 * QuickPass - Email Verification Manager
 */

import { EmailMessage, Mailbox } from '../shared/types';
import { EmailProvider } from './provider.interface';
import { MessageParser, VerificationData } from './message-parser';
import { createError } from '../shared/errors';

export interface WaitForVerificationOptions {
  mailbox: Mailbox;
  provider: EmailProvider;
  startedAt: number;
  timeoutSeconds: number;
  targetOrigin: string;
  onProgress?: (elapsedSeconds: number) => void;
}

export class VerificationManager {
  /**
   * Polls the mailbox until a verification message is received or timeout is reached.
   */
  public async waitForVerification(
    options: WaitForVerificationOptions
  ): Promise<{ message: EmailMessage; verification: VerificationData }> {
    const { mailbox, provider, startedAt, timeoutSeconds, targetOrigin, onProgress } = options;
    const timeoutMs = timeoutSeconds * 1000;
    const pollIntervalMs = 3500;
    const endTime = Date.now() + timeoutMs;

    while (Date.now() < endTime) {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      onProgress?.(elapsed);

      try {
        const messages = await provider.getMessages(mailbox);

        // The mailbox is created for this registration, so all its messages are relevant.
        // Provider timestamps may also be missing or inaccurate.
        const relevant = provider.id === 'own-mail'
          ? messages.filter((message) =>
              message.receivedAt >= startedAt - 60_000 && this.matchesOrigin(message, targetOrigin)
            )
          : messages;

        for (const summary of [...relevant].sort((a, b) => b.receivedAt - a.receivedAt)) {
          let fullMessage = summary;
          try {
            fullMessage = await provider.getMessage(mailbox, summary.id);
          } catch (e) {
            console.warn('Could not fetch full message content, falling back to summary:', e);
          }

          const verification = MessageParser.extractVerification(fullMessage, targetOrigin);
          if (verification.type !== 'none') {
            return { message: fullMessage, verification };
          }
        }
      } catch (err: any) {
        console.warn('Error polling messages in VerificationManager:', err.message);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw createError(
      'EMAIL_TIMEOUT',
      `Письмо подтверждения не получено за ${timeoutSeconds} сек. Вы можете запросить повторную отправку на сайте.`,
      { recoverable: true, suggestedAction: 'retry' }
    );
  }

  private matchesOrigin(message: EmailMessage, targetOrigin: string): boolean {
    try {
      const target = new URL(targetOrigin).hostname.toLowerCase().replace(/^www\./, '');
      const fromAddress = message.from.match(/[\w.+-]+@([\w.-]+)/)?.[1]?.toLowerCase();
      if (fromAddress && (fromAddress === target || fromAddress.endsWith(`.${target}`))) return true;
      const link = MessageParser.findVerificationLink(message.html || '', message.text || '', targetOrigin)?.link;
      if (!link) return false;
      const host = new URL(link).hostname.toLowerCase().replace(/^www\./, '');
      return host === target || host.endsWith(`.${target}`);
    } catch {
      return false;
    }
  }
}
