import { describe, it, expect, beforeEach } from 'vitest';
import { FormDetector } from '../content/form-detector';

describe('FormDetector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects standard registration form with email, password, and confirm password', () => {
    document.body.innerHTML = `
      <form id="signup-form">
        <label for="user-email">Email:</label>
        <input id="user-email" type="email" name="email" required />

        <label for="user-pass">Пароль:</label>
        <input id="user-pass" type="password" name="password" autocomplete="new-password" required />

        <label for="user-pass-repeat">Повторите пароль:</label>
        <input id="user-pass-repeat" type="password" name="confirm_password" required />

        <button type="submit">Зарегистрироваться</button>
      </form>
    `;

    const detected = FormDetector.detectRegistrationForm();
    expect(detected).not.toBeNull();
    expect(detected?.fields.some((f) => f.purpose === 'email')).toBe(true);
    expect(detected?.fields.some((f) => f.purpose === 'password')).toBe(true);
    expect(detected?.fields.some((f) => f.purpose === 'confirm_password')).toBe(true);
    expect(detected?.submitButtonSelector).toBe('#signup-form > button');
  });

  it('distinguishes login form from registration form', () => {
    document.body.innerHTML = `
      <form id="login-form">
        <input id="login-email" type="email" name="email" />
        <input id="login-pass" type="password" name="password" />
        <button type="submit">Войти</button>
      </form>
    `;

    const detected = FormDetector.detectRegistrationForm();
    // Pure login form should not be classified as a registration form
    expect(detected).toBeNull();
  });

  it('selects visible registration form instead of hidden login form in a modal frame', () => {
    document.body.innerHTML = `
      <div style="display:none"><form name="login"><input name="username" placeholder="Email / Uid" /><input type="password" name="password" /></form></div>
      <div class="fast-register">
        <form name="register">
          <div>Create Account</div>
          <input id="num" name="num" placeholder="Email address" />
          <input name="code" placeholder="Verification code" />
          <div id="code-shade-box">Get the verification code</div>
          <input id="password" type="password" name="password" />
          <input id="password2" type="password" name="password2" placeholder="Confirm password" />
          <button type="submit">Create Account</button>
        </form>
      </div>
    `;
    const detected = FormDetector.detectRegistrationForm();
    expect(detected?.fields.find((field) => field.purpose === 'email')?.selector).toBe('#num');
    expect(detected?.fields.find((field) => field.purpose === 'password')?.selector).toBe('#password');
    expect(detected?.fields.find((field) => field.purpose === 'confirm_password')?.selector).toBe('#password2');
    expect(detected?.verificationCodeRequestSelector).toBe('#code-shade-box');
  });
});
