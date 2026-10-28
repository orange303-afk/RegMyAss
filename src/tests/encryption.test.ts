import { describe, it, expect } from 'vitest';
import { VaultEncryption } from '../storage/encryption';

describe('VaultEncryption', () => {
  it('encrypts and decrypts secrets with AES-GCM and PBKDF2', async () => {
    const secret = 'SuperSecretP@ssw0rd!2026';
    const masterPassword = 'MasterPassword123#';

    const encrypted = await VaultEncryption.encrypt(secret, masterPassword);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.salt).toBeTruthy();

    const decrypted = await VaultEncryption.decrypt(encrypted, masterPassword);
    expect(decrypted).toBe(secret);
  });

  it('fails decryption when provided incorrect master password', async () => {
    const secret = 'ConfidentialData';
    const encrypted = await VaultEncryption.encrypt(secret, 'CorrectPass123');

    await expect(
      VaultEncryption.decrypt(encrypted, 'WrongPassword456')
    ).rejects.toThrow();
  });
});
