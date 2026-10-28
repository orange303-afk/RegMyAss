/**
 * QuickPass - Account Manager
 * Coordinates account persistence, reuse, and secure credential storage.
 */

import { AppDatabase } from '../storage/database';
import { VaultEncryption } from '../storage/encryption';
import { GeneratedAccountData, Mailbox, StoredAccount, UserSettings } from '../shared/types';

export class AccountManager {
  private db: AppDatabase;

  constructor(db: AppDatabase = new AppDatabase()) {
    this.db = db;
  }

  /**
   * Retrieves an existing account for a website origin if one exists.
   */
  public async getExistingAccount(origin: string): Promise<StoredAccount | null> {
    return this.db.getAccountByOrigin(origin);
  }

  /**
   * Saves a newly registered account.
   */
  public async saveAccount(
    accountData: GeneratedAccountData,
    mailbox: Mailbox,
    settings: UserSettings,
    masterPassword?: string
  ): Promise<StoredAccount> {
    const accountId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    let encryptedPassword: string | undefined;
    let iv: string | undefined;
    let salt: string | undefined;

    if (settings.storageMode === 'encrypted_local' && masterPassword) {
      const encrypted = await VaultEncryption.encrypt(accountData.password, masterPassword);
      encryptedPassword = encrypted.ciphertext;
      iv = encrypted.iv;
      salt = encrypted.salt;
    }

    const stored: StoredAccount = {
      id: accountId,
      origin: accountData.origin,
      email: accountData.email,
      username: accountData.username,
      providerId: accountData.providerId,
      registrationState: 'completed',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      storageMode: settings.storageMode,
      encryptedPassword,
      iv,
      salt,
      mailboxData: {
        id: mailbox.id,
        token: mailbox.token,
        password: mailbox.password,
      },
    };

    await this.db.saveAccount(stored);
    return stored;
  }

  /**
   * Fetches all registered accounts.
   */
  public async getAllAccounts(): Promise<StoredAccount[]> {
    return this.db.getAllAccounts();
  }

  /**
   * Deletes an account by id.
   */
  public async deleteAccount(id: string): Promise<void> {
    return this.db.deleteAccount(id);
  }
}
