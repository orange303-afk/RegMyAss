/**
 * QuickPass - Login & Session Detector
 * Detects existing authenticated sessions and login form elements for 1-click login.
 */

import { FormFiller } from './form-filler';

export interface LoginFormElements {
  loginInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  submitButton?: HTMLElement;
}

export class LoginDetector {
  /**
   * Checks if user has an active authenticated session on current page.
   */
  public static hasActiveSession(): boolean {
    const text = document.body?.textContent?.toLowerCase() || '';

    const logoutKeywords = [
      'logout',
      'log out',
      'sign out',
      'выйти',
      'выход',
      'личный кабинет',
      'my account',
      'dashboard',
    ];

    const logoutLinks = document.querySelectorAll(
      'a[href*="logout"], a[href*="signout"], button[id*="logout"], button[class*="logout"], [data-testid*="logout"]'
    );

    if (logoutLinks.length > 0) return true;

    for (const kw of logoutKeywords) {
      if (text.includes(kw)) {
        // Confirm with specific clickable elements
        const match = Array.from(document.querySelectorAll('a, button, span')).some(
          (el) => el.textContent?.trim().toLowerCase() === kw
        );
        if (match) return true;
      }
    }

    return false;
  }

  /**
   * Detects login form on page to autofill existing credentials.
   */
  public static detectLoginForm(): LoginFormElements | null {
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    if (passwordInputs.length === 0) return null;

    const passwordInput = passwordInputs[0];
    const form = passwordInput.closest('form') || document.body;

    const textInputs = Array.from(
      form.querySelectorAll('input[type="email"], input[type="text"], input:not([type])')
    ) as HTMLInputElement[];

    const loginInput =
      textInputs.find(
        (i) =>
          i.type === 'email' ||
          i.name.toLowerCase().includes('email') ||
          i.name.toLowerCase().includes('user') ||
          i.name.toLowerCase().includes('login') ||
          i.id.toLowerCase().includes('email') ||
          i.id.toLowerCase().includes('login')
      ) || textInputs[0];

    if (!loginInput) return null;

    const submitButton =
      form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement ||
      Array.from(form.querySelectorAll('button')).find((b) =>
        /login|sign in|войти|вход/i.test(b.textContent || '')
      );

    return {
      loginInput,
      passwordInput,
      submitButton: submitButton || undefined,
    };
  }

  /**
   * Fills and submits login form with saved credentials.
   */
  public static fillAndSubmitLogin(login: string, password: string): boolean {
    const detected = this.detectLoginForm();
    if (!detected) return false;

    FormFiller.setInputValue(detected.loginInput, login);
    FormFiller.setInputValue(detected.passwordInput, password);

    if (detected.submitButton) {
      detected.submitButton.click();
      return true;
    }

    const form = detected.passwordInput.closest('form');
    if (form) {
      form.submit();
      return true;
    }

    return false;
  }
}
