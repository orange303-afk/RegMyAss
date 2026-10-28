import { describe, it, expect } from 'vitest';
import { AppDatabase } from '../storage/database';
import { StoredAccount } from '../shared/types';

describe('AppDatabase', () => {
  it('saves and retrieves accounts by origin and id', async () => {
    const db = new AppDatabase();
    const account: StoredAccount = {
      id: 'acc_test_1',
      origin: 'https://example.com',
      email: 'user@temp.com',
      providerId: 'mail-tm',
      registrationState: 'completed',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      storageMode: 'google_password_manager',
    };

    await db.saveAccount(account);

    const retrieved = await db.getAccountByOrigin('https://example.com');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.email).toBe('user@temp.com');
    expect(retrieved?.id).toBe('acc_test_1');

    const byId = await db.getAccountById('acc_test_1');
    expect(byId).not.toBeNull();
    expect(byId?.origin).toBe('https://example.com');

    await db.deleteAccount('acc_test_1');
    const afterDelete = await db.getAccountById('acc_test_1');
    expect(afterDelete).toBeNull();
  });
});
