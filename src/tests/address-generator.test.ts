import { describe, it, expect } from 'vitest';
import { AddressGenerator, COUNTRY_PRESETS } from '../accounts/address-generator';
import { AccountGenerator } from '../accounts/account-generator';
import { DEFAULT_SETTINGS } from '../shared/constants';

describe('AddressGenerator', () => {
  it('generates valid realistic address and postal codes for all supported countries', () => {
    for (const countryCode of Object.keys(COUNTRY_PRESETS)) {
      const address = AddressGenerator.generateAddress(countryCode);
      expect(address.countryCode).toBe(countryCode);
      expect(address.city).toBeTruthy();
      expect(address.postalCode).toBeTruthy();
      expect(address.street).toBeTruthy();
      expect(address.phone).toBeTruthy();
    }
  });

  it('generates valid US address with 5-digit ZIP code', () => {
    const address = AddressGenerator.generateAddress('US');
    expect(address.country).toBe('United States');
    expect(address.postalCode).toMatch(/^[0-9]{5}$/);
    expect(address.phone.startsWith('+1')).toBe(true);
  });

  it('uses custom user profile when enabled in settings', () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      profile: {
        useCustomProfile: true,
        firstName: 'Dmitry',
        lastName: 'Petrov',
        country: 'RU',
        city: 'Москва',
        street: 'ул. Тверская 15',
        postalCode: '125009',
        phone: '+7 (999) 111-22-33',
      },
    };

    const data = AccountGenerator.generateAccountData(
      'user@temp.com',
      'https://example.com',
      'mail-tm',
      customSettings
    );

    expect(data.firstName).toBe('Dmitry');
    expect(data.lastName).toBe('Petrov');
    expect(data.city).toBe('Москва');
    expect(data.street).toBe('ул. Тверская 15');
    expect(data.postalCode).toBe('125009');
    expect(data.phone).toBe('+7 (999) 111-22-33');
  });
});
