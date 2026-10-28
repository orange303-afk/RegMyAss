/**
 * QuickPass - Form Filler
 * Robust form filling compatible with React, Vue, Angular, and vanilla DOM.
 */

import { FieldPurpose, GeneratedAccountData } from '../shared/types';

export class FormFiller {
  /**
   * Fills detected form fields with generated account data.
   */
  public static fillForm(
    accountData: GeneratedAccountData,
    fields: Array<{ selector: string; purpose: FieldPurpose }>
  ): boolean {
    let filledAny = false;

    for (const field of fields) {
      const el = document.querySelector(field.selector) as HTMLInputElement | null;
      if (!el) continue;

      let valueToSet: string | null = null;

      switch (field.purpose) {
        case 'email':
          valueToSet = accountData.email;
          break;
        case 'password':
        case 'confirm_password':
          valueToSet = accountData.password;
          break;
        case 'username':
          valueToSet = accountData.username;
          break;
        case 'first_name':
          valueToSet = accountData.firstName || 'Alex';
          break;
        case 'last_name':
          valueToSet = accountData.lastName || 'Miller';
          break;
        case 'country':
          if (el.tagName === 'SELECT') {
            this.setSelectValue(el as unknown as HTMLSelectElement, accountData.country || 'United States');
            filledAny = true;
            continue;
          }
          valueToSet = accountData.country || 'United States';
          break;
        case 'city':
          valueToSet = accountData.city || 'New York';
          break;
        case 'street':
          valueToSet = accountData.street || '100 Broadway';
          break;
        case 'postal_code':
          valueToSet = accountData.postalCode || '10001';
          break;
        case 'phone':
          valueToSet = accountData.phone || '+1 (555) 234-5678';
          break;
        case 'checkbox_terms':
          this.setCheckbox(el, true);
          filledAny = true;
          continue;
        default:
          break;
      }

      if (valueToSet !== null) {
        this.setInputValue(el, valueToSet);
        filledAny = true;
      }
    }

    return filledAny;
  }

  /**
   * Sets input value and triggers framework events (React, Vue, Angular compatible).
   */
  public static setInputValue(input: HTMLInputElement, value: string): void {
    input.focus();

    // Use native prototype setter to bypass React 16+ synthetic wrapper
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch essential input events in order
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Toggles checkbox element with proper synthetic events.
   */
  public static setCheckbox(checkbox: HTMLInputElement, checked: boolean): void {
    if (checkbox.checked === checked) return;

    checkbox.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'checked'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(checkbox, checked);
    } else {
      checkbox.checked = checked;
    }

    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }

  /**
   * Sets value for <select> dropdowns.
   */
  public static setSelectValue(select: HTMLSelectElement, targetValue: string): void {
    select.focus();
    const options = Array.from(select.options);
    const lower = targetValue.toLowerCase();

    const match =
      options.find((opt) => opt.value.toLowerCase() === lower || opt.text.toLowerCase().includes(lower)) ||
      options[1] || // Skip first placeholder if present
      options[0];

    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      select.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
  }

  /**
   * Submits the registration form by clicking the submit button or dispatching submit.
   */
  public static submitForm(submitButtonSelector?: string, formSelector?: string): boolean {
    if (submitButtonSelector) {
      const btn = document.querySelector(submitButtonSelector) as HTMLElement | null;
      if (btn) {
        btn.focus();
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        btn.click();
        return true;
      }
    }

    if (formSelector) {
      const form = document.querySelector(formSelector) as HTMLFormElement | null;
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
        if (!event.defaultPrevented) {
          form.submit();
        }
        return true;
      }
    }

    // Try finding any submit button in active form
    const fallbackBtn = document.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement | null;
    if (fallbackBtn) {
      fallbackBtn.click();
      return true;
    }

    return false;
  }

  /**
   * Universal OTP / verification code filler.
   * Handles single inputs, segmented multi-box inputs (e.g. 6 boxes [ ][ ][ ][ ][ ][ ]),
   * and dispatches synthetic paste/keystroke events for React / Vue libraries.
   */
  public static fillOtpCode(code: string): boolean {
    const cleanCode = code.trim();
    if (!cleanCode) return false;

    // 1. Look for segmented multi-box inputs (like on CGTrader)
    const modalOrContainer =
      document.querySelector('[role="dialog"], [aria-modal="true"], .modal, .popup, form') || document.body;

    const visibleInputs = Array.from(
      modalOrContainer.querySelectorAll('input:not([type="hidden"]):not([disabled])')
    ) as HTMLInputElement[];

    const singleDigitBoxes = visibleInputs.filter(
      (input) =>
        input.maxLength === 1 ||
        input.getAttribute('maxlength') === '1' ||
        input.size === 1 ||
        input.className.toLowerCase().includes('otp') ||
        input.className.toLowerCase().includes('digit') ||
        input.className.toLowerCase().includes('pin')
    );

    // If we found a group of inputs matching or close to code length (e.g. 6 boxes)
    const segmentedInputs =
      singleDigitBoxes.length >= 4
        ? singleDigitBoxes
        : visibleInputs.length === cleanCode.length
        ? visibleInputs
        : [];

    if (segmentedInputs.length >= cleanCode.length) {
      // 1a. Try pasting into first input
      const firstInput = segmentedInputs[0];
      firstInput.focus();
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', cleanCode);
        firstInput.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      } catch {
        // ignore
      }

      // 1b. Fill each box individually and trigger input + keyboard events
      for (let i = 0; i < Math.min(segmentedInputs.length, cleanCode.length); i++) {
        const digit = cleanCode[i];
        const box = segmentedInputs[i];
        box.focus();
        this.setInputValue(box, digit);
        box.dispatchEvent(new KeyboardEvent('keydown', { key: digit, bubbles: true }));
        box.dispatchEvent(new KeyboardEvent('keypress', { key: digit, bubbles: true }));
        box.dispatchEvent(new KeyboardEvent('keyup', { key: digit, bubbles: true }));
      }

      this.triggerOtpSubmit(modalOrContainer);
      return true;
    }

    // 2. Single input field
    const singleInput = document.querySelector(
      'input[autocomplete="one-time-code"], input[name*="code" i], input[name*="otp" i], input[id*="code" i], input[placeholder*="код" i], input[placeholder*="code" i]'
    ) as HTMLInputElement | null;

    if (singleInput) {
      singleInput.focus();
      this.setInputValue(singleInput, cleanCode);
      this.triggerOtpSubmit(singleInput.closest('form, [role="dialog"]') || document.body);
      return true;
    }

    return false;
  }

  private static triggerOtpSubmit(container: Element): void {
    const submitBtn = Array.from(container.querySelectorAll('button, input[type="submit"]')).find((b) =>
      /confirm|verify|подтверд|continue|submit|войти|заверш/i.test(b.textContent || (b as HTMLInputElement).value || '')
    ) as HTMLElement | undefined;

    if (submitBtn) {
      setTimeout(() => submitBtn.click(), 300);
    }
  }
}
