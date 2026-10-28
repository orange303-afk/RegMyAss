import { describe, it, expect } from 'vitest';
import { AccountGenerator } from '../accounts/account-generator';
import { DEFAULT_SETTINGS } from '../shared/constants';

describe('AccountGenerator', () => {
  it('generates passwords meeting length and symbol requirements', () => {
    const password = AccountGenerator.generatePassword(24, {
      requireNumbers: true,
      requireSymbols: true,
    });

    expect(password.length).toBe(24);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[!@#$%&*-_=+]/.test(password)).toBe(true);
  });

  it('generates usernames according to template', () => {
    const username = AccountGenerator.generateUsername('user_{random}');
    expect(username.startsWith('user_')).toBe(true);
    expect(username.length).toBeGreaterThan(6);

    const semantic = AccountGenerator.generateUsername('{adjective}_{noun}_{num}');
    expect(semantic.includes('_')).toBe(true);
  });

  it('generates complete account data with non-empty fields', () => {
    const data = AccountGenerator.generateAccountData(
      'test@example.com',
      'https://target.com',
      'mail-tm',
      DEFAULT_SETTINGS
    );

    expect(data.email).toBe('test@example.com');
    expect(data.origin).toBe('https://target.com');
    expect(data.providerId).toBe('mail-tm');
    expect(data.password.length).toBe(DEFAULT_SETTINGS.passwordLength);
    expect(data.username).toBeTruthy();
    expect(data.firstName).toBeTruthy();
    expect(data.lastName).toBeTruthy();
  });
});
