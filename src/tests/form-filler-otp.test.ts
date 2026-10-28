import { describe, it, expect, beforeEach } from 'vitest';
import { FormFiller } from '../content/form-filler';

describe('FormFiller OTP segmented inputs', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('fills segmented multi-box OTP inputs with 6 individual digits', () => {
    document.body.innerHTML = `
      <div class="modal">
        <h2>Check your inbox</h2>
        <div class="otp-container">
          <input class="digit-box" maxlength="1" />
          <input class="digit-box" maxlength="1" />
          <input class="digit-box" maxlength="1" />
          <input class="digit-box" maxlength="1" />
          <input class="digit-box" maxlength="1" />
          <input class="digit-box" maxlength="1" />
        </div>
      </div>
    `;

    const success = FormFiller.fillOtpCode('749201');
    expect(success).toBe(true);

    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.digit-box'));
    expect(inputs.map((i) => i.value).join('')).toBe('749201');
  });

  it('fills single standard one-time-code input', () => {
    document.body.innerHTML = `
      <form>
        <input id="otp" name="code" autocomplete="one-time-code" />
      </form>
    `;

    const success = FormFiller.fillOtpCode('583912');
    expect(success).toBe(true);

    const input = document.getElementById('otp') as HTMLInputElement;
    expect(input.value).toBe('583912');
  });
});
