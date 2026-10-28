import { describe, it, expect } from 'vitest';
import { MessageParser } from '../email/message-parser';
import { EmailMessage } from '../shared/types';

describe('MessageParser', () => {
  it('extracts confirmation link from HTML email', () => {
    const message: EmailMessage = {
      id: '1',
      from: 'noreply@site.com',
      to: 'user@temp.com',
      subject: 'Please confirm your email',
      html: `
        <div>
          <h2>Welcome!</h2>
          <p>Click below to verify your account:</p>
          <a href="https://site.com/auth/verify?token=abc123xyz">Подтвердить регистрацию</a>
        </div>
      `,
      receivedAt: Date.now(),
    };

    const result = MessageParser.extractVerification(message, 'https://site.com');
    expect(result.type).toBe('link');
    expect(result.link).toBe('https://site.com/auth/verify?token=abc123xyz');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('extracts OTP code from plain text email', () => {
    const message: EmailMessage = {
      id: '2',
      from: 'service@target.com',
      to: 'user@temp.com',
      subject: 'Код подтверждения',
      text: 'Здравствуйте! Ваш код подтверждения для входа: 481920. Никому его не сообщайте.',
      receivedAt: Date.now(),
    };

    const result = MessageParser.extractVerification(message);
    expect(result.type).toBe('code');
    expect(result.code).toBe('481920');
  });

  it('sanitizes dangerous URLs and ignores javascript schemes', () => {
    const malicious = MessageParser.sanitizeUrl('javascript:alert(1)');
    expect(malicious).toBeNull();

    const valid = MessageParser.sanitizeUrl('https://example.com/activate?t=123');
    expect(valid).toBe('https://example.com/activate?t=123');
  });
});
