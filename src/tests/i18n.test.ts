import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { isLocale, t, translateError } from '../shared/i18n';

describe('interface localization', () => {
  it('defaults new installations to English', () => {
    expect(DEFAULT_SETTINGS.locale).toBe('en');
    expect(isLocale('ru')).toBe(true);
  });

  it('translates every Russian key used by the popup and settings', () => {
    for (const file of ['src/ui/popup/Popup.tsx', 'src/ui/options/Options.tsx']) {
      const source = readFileSync(file, 'utf8');
      const keys = [...source.matchAll(/\btr\('([^']+)'\)/g)].map((match) => match[1]);
      for (const key of keys.filter((value) => /[А-Яа-яЁё]/.test(value))) {
        expect(t('en', key), `${file}: ${key}`).not.toMatch(/[А-Яа-яЁё]/);
        expect(t('es', key), `${file}: ${key}`).not.toMatch(/[А-Яа-яЁё]/);
      }
    }
  });

  it('translates a dynamic email timeout', () => {
    expect(translateError('en', 'Письмо подтверждения не получено за 180 сек. Вы можете запросить повторную отправку на сайте.')).toContain('180 seconds');
    expect(translateError('es', 'Письмо подтверждения не получено за 180 сек. Вы можете запросить повторную отправку на сайте.')).toContain('180 segundos');
    expect(translateError('ru', 'Письмо подтверждения не получено за 180 сек. Вы можете запросить повторную отправку на сайте.')).toContain('180 сек.');
  });

  it('restores Russian interface copy', () => {
    expect(t('ru', 'Настройки')).toBe('Настройки');
    expect(t('ru', 'Connected mailbox')).toBe('Подключён ящик');
    expect(t('ru', 'Mailbox created:')).toBe('Успешно создан ящик:');
  });
});
