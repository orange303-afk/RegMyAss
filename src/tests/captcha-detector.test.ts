import { describe, it, expect, beforeEach } from 'vitest';
import { CaptchaDetector } from '../content/captcha-detector';

describe('CaptchaDetector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects Google reCAPTCHA v2 and checks resolution status', () => {
    document.body.innerHTML = `
      <div class="g-recaptcha" data-sitekey="xyz"></div>
      <textarea id="g-recaptcha-response" name="g-recaptcha-response"></textarea>
    `;

    let status = CaptchaDetector.detectCaptcha();
    expect(status.present).toBe(true);
    expect(status.type).toBe('recaptcha-v2');
    expect(status.resolved).toBe(false);

    // Simulate solved captcha token
    const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
    textarea.value = 'dummy_solved_token_xyz';

    status = CaptchaDetector.detectCaptcha();
    expect(status.resolved).toBe(true);
  });

  it('detects Cloudflare Turnstile', () => {
    document.body.innerHTML = `
      <div class="cf-turnstile"></div>
      <input type="hidden" name="cf-turnstile-response" value="" />
    `;

    const status = CaptchaDetector.detectCaptcha();
    expect(status.present).toBe(true);
    expect(status.type).toBe('turnstile');
    expect(status.resolved).toBe(false);
  });
});
