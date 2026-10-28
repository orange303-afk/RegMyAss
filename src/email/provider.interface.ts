/**
 * QuickPass - Email Provider Interface
 */

import { EmailMessage, EmailProviderCapabilities, Mailbox } from '../shared/types';

export interface EmailProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: EmailProviderCapabilities;

  /**
   * Checks if the provider API is currently reachable and operational.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generates a new temporary mailbox.
   */
  createMailbox(): Promise<Mailbox>;

  /**
   * Fetches incoming email messages for the given mailbox.
   */
  getMessages(mailbox: Mailbox): Promise<EmailMessage[]>;

  /**
   * Fetches the full content of a specific email message.
   */
  getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage>;

  /**
   * Optional mailbox deletion.
   */
  deleteMailbox?(mailbox: Mailbox): Promise<void>;
}
