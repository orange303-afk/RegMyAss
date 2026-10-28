/**
 * QuickPass - Account Generator
 * Cryptographically secure password and account data generation.
 */

import { GeneratedAccountData, UserSettings } from '../shared/types';
import { AddressGenerator } from './address-generator';

export class AccountGenerator {
  private static readonly LOWERCASE = 'abcdefghjkmnpqrstuvwxyz'; // without ambiguous i, l, o
  private static readonly UPPERCASE = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // without ambiguous I, L, O
  private static readonly NUMBERS = '23456789'; // without 0, 1
  private static readonly SYMBOLS = '!@#$%&*-_=+';

  private static readonly ADJECTIVES = [
    'swift',
    'bright',
    'silent',
    'clever',
    'brave',
    'rapid',
    'calm',
    'prime',
    'epic',
    'stellar',
    'solar',
    'lunar',
  ];

  private static readonly NOUNS = [
    'fox',
    'falcon',
    'tiger',
    'hawk',
    'wolf',
    'lynx',
    'eagle',
    'otter',
    'badger',
    'raven',
    'runner',
    'pilot',
  ];

  private static readonly FIRST_NAMES = [
    'Alex',
    'Sam',
    'Jordan',
    'Taylor',
    'Morgan',
    'Robin',
    'Casey',
    'Chris',
  ];

  private static readonly LAST_NAMES = [
    'Miller',
    'Smith',
    'Taylor',
    'Davis',
    'Wilson',
    'Clark',
    'Hall',
    'Baker',
  ];

  /**
   * Generates a cryptographically secure random password meeting strict criteria.
   * Never uses Math.random().
   */
  public static generatePassword(
    length: number = 20,
    options: { requireNumbers?: boolean; requireSymbols?: boolean } = {}
  ): string {
    const { requireNumbers = true, requireSymbols = true } = options;

    let charset = this.LOWERCASE + this.UPPERCASE;
    if (requireNumbers) charset += this.NUMBERS;
    if (requireSymbols) charset += this.SYMBOLS;

    const targetLength = Math.max(12, Math.min(length, 64));

    // Ensure at least one character from each required category
    let password = '';
    password += this.getRandomChar(this.LOWERCASE);
    password += this.getRandomChar(this.UPPERCASE);
    if (requireNumbers) password += this.getRandomChar(this.NUMBERS);
    if (requireSymbols) password += this.getRandomChar(this.SYMBOLS);

    // Fill remaining characters
    while (password.length < targetLength) {
      password += this.getRandomChar(charset);
    }

    // Cryptographic shuffle
    return this.cryptoShuffle(password);
  }

  /**
   * Generates a realistic username according to template.
   */
  public static generateUsername(template: string = 'user_{random}'): string {
    const randomSuffix = this.getRandomInt(1000, 99999);
    const adj = this.ADJECTIVES[this.getRandomInt(0, this.ADJECTIVES.length - 1)];
    const noun = this.NOUNS[this.getRandomInt(0, this.NOUNS.length - 1)];

    return template
      .replace('{random}', randomSuffix.toString())
      .replace('{adjective}', adj)
      .replace('{noun}', noun)
      .replace('{num}', this.getRandomInt(10, 99).toString());
  }

  /**
   * Generates complete account data for a site with realistic country, city, street and ZIP.
   */
  public static generateAccountData(
    email: string,
    origin: string,
    providerId: string,
    settings: UserSettings
  ): GeneratedAccountData {
    const password = this.generatePassword(settings.passwordLength, {
      requireNumbers: settings.passwordRequireNumbers,
      requireSymbols: settings.passwordRequireSymbols,
    });

    const username = this.generateUsername(settings.usernameTemplate);

    const profile = settings.profile;
    const countryCode = profile?.country || 'US';
    const addressData = AddressGenerator.generateAddress(countryCode);

    let firstName = this.FIRST_NAMES[this.getRandomInt(0, this.FIRST_NAMES.length - 1)];
    let lastName = this.LAST_NAMES[this.getRandomInt(0, this.LAST_NAMES.length - 1)];
    let street = addressData.street;
    let city = addressData.city;
    let postalCode = addressData.postalCode;
    let phone = addressData.phone;
    let country = addressData.country;

    if (profile?.useCustomProfile) {
      if (profile.firstName?.trim()) firstName = profile.firstName.trim();
      if (profile.lastName?.trim()) lastName = profile.lastName.trim();
      if (profile.street?.trim()) street = profile.street.trim();
      if (profile.city?.trim()) city = profile.city.trim();
      if (profile.postalCode?.trim()) postalCode = profile.postalCode.trim();
      if (profile.phone?.trim()) phone = profile.phone.trim();
    }

    return {
      email,
      username,
      password,
      firstName,
      lastName,
      country,
      city,
      street,
      postalCode,
      phone,
      origin,
      providerId,
    };
  }

  /**
   * Gets a random character from a character set using Web Crypto API.
   */
  private static getRandomChar(chars: string): string {
    const index = this.getRandomInt(0, chars.length - 1);
    return chars[index];
  }

  /**
   * Returns a cryptographically secure random integer between min and max (inclusive).
   */
  public static getRandomInt(min: number, max: number): number {
    const range = max - min + 1;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] % range);
  }

  /**
   * Shuffles a string using Fisher-Yates with crypto.getRandomValues.
   */
  private static cryptoShuffle(str: string): string {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.getRandomInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }
}
