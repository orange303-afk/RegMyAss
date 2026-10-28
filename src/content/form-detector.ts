/**
 * QuickPass - Form Detector
 * Analyzes DOM to detect registration forms and map fields.
 */

import { DetectedForm, FieldPurpose, FormFieldInfo } from '../shared/types';

export class FormDetector {
  /**
   * Scans the document (and open shadow roots) for registration forms.
   */
  public static detectRegistrationForm(): DetectedForm | null {
    // 1. First look for explicit <form> tags
    const forms = Array.from(document.querySelectorAll('form'));
    for (const form of forms) {
      if (!this.isVisible(form)) continue;
      const detected = this.analyzeFormContainer(form);
      if (detected && this.isLikelyRegistration(detected, form)) {
        return detected;
      }
    }

    // 2. Look for modal or container divs without a <form> tag (common in React/Vue SPAs)
    const modalContainers = Array.from(
      document.querySelectorAll('[role="dialog"], .modal, .popup, [aria-modal="true"], #signup, .signup-container')
    );
    for (const container of modalContainers) {
      if (!this.isVisible(container as HTMLElement)) continue;
      const detected = this.analyzeFormContainer(container as HTMLElement);
      if (detected && this.isLikelyRegistration(detected, container as HTMLElement)) {
        return detected;
      }
    }

    // 3. Fallback: scan whole document for orphan inputs
    const docDetected = this.analyzeFormContainer(document.body);
    if (docDetected && this.isLikelyRegistration(docDetected, document.body)) {
      return docDetected;
    }

    return null;
  }

  /**
   * Analyzes an element container (form or div) for form fields.
   */
  private static analyzeFormContainer(container: HTMLElement): DetectedForm | null {
    const inputs = Array.from(container.querySelectorAll('input, select'));
    if (inputs.length === 0) return null;

    const fields: FormFieldInfo[] = [];
    let passwordCount = 0;

    for (const el of inputs) {
      const input = el as HTMLInputElement;

      // Ignore hidden or disabled inputs
      if (input.type === 'hidden' || input.disabled || input.style.display === 'none') {
        continue;
      }
      if (!this.isVisible(input)) continue;

      const purpose = this.identifyFieldPurpose(input, passwordCount);
      if (purpose === 'password') {
        passwordCount++;
      } else if (purpose === 'confirm_password') {
        passwordCount++;
      }

      if (purpose !== 'unknown') {
        fields.push({
          selector: this.getElementSelector(input),
          purpose,
          required: input.required || input.getAttribute('aria-required') === 'true',
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          label: this.getFieldLabel(input),
          currentValue: input.value,
        });
      }
    }

    // Must have at least an email and a password field to qualify
    const hasEmail = fields.some((f) => f.purpose === 'email');
    const hasPassword = fields.some((f) => f.purpose === 'password');

    if (!hasEmail && !hasPassword) {
      return null;
    }

    const submitBtn = this.findSubmitButton(container);
    const codeRequest = this.findVerificationCodeRequest(container);
    const isModal = Boolean(
      container.closest('[role="dialog"], [aria-modal="true"], .modal, .popup') ||
      container.getAttribute('role') === 'dialog'
    );

    return {
      formSelector: this.getElementSelector(container),
      isInsideModal: isModal,
      fields,
      submitButtonSelector: submitBtn ? this.getElementSelector(submitBtn) : undefined,
      verificationCodeRequestSelector: codeRequest ? this.getElementSelector(codeRequest) : undefined,
      captchaPresent: Boolean(
        container.querySelector('.g-recaptcha, .cf-turnstile, .h-captcha, iframe[src*="recaptcha"], iframe[src*="turnstile"]')
      ),
    };
  }

  private static findVerificationCodeRequest(container: HTMLElement): HTMLElement | null {
    if (!container.querySelector('input[name*="code" i], input[id*="code" i], input[placeholder*="code" i], input[placeholder*="код" i]')) {
      return null;
    }
    const candidates = Array.from(container.querySelectorAll<HTMLElement>('button, a, [role="button"], div[id], span[id]'));
    return candidates.find((element) =>
      this.isVisible(element) &&
      /(?:get|send|request).*(?:verification|confirm|security).*code|получить.*код|выслать.*код/i.test(element.textContent?.trim() || '')
    ) || null;
  }

  private static isVisible(element: Element): boolean {
    for (let current: Element | null = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  }

  /**
   * Identifies the semantic purpose of an input element.
   */
  private static identifyFieldPurpose(input: HTMLInputElement, currentPasswordCount: number): FieldPurpose {
    const type = (input.type || 'text').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    const label = this.getFieldLabel(input).toLowerCase();

    const allMeta = `${name} ${id} ${placeholder} ${autocomplete} ${label}`;

    // 1. Password identification
    if (type === 'password' || autocomplete.includes('password')) {
      if (
        autocomplete === 'new-password' && currentPasswordCount > 0 ||
        allMeta.includes('confirm') ||
        allMeta.includes('repeat') ||
        allMeta.includes('retype') ||
        allMeta.includes('повтор') ||
        allMeta.includes('подтвержд') ||
        allMeta.includes('passwd2') ||
        allMeta.includes('pass2')
      ) {
        return 'confirm_password';
      }

      if (currentPasswordCount === 0) {
        return 'password';
      }
      return 'confirm_password';
    }

    // 2. Email identification
    if (
      type === 'email' ||
      autocomplete === 'email' ||
      allMeta.includes('email') ||
      allMeta.includes('e-mail') ||
      allMeta.includes('почт')
    ) {
      return 'email';
    }

    // 3. Username / Login
    if (
      autocomplete === 'username' ||
      allMeta.includes('username') ||
      allMeta.includes('login') ||
      allMeta.includes('логин') ||
      allMeta.includes('ник') ||
      allMeta.includes('user_name')
    ) {
      return 'username';
    }

    // 4. First name / Last name
    if (
      autocomplete === 'given-name' ||
      allMeta.includes('firstname') ||
      allMeta.includes('first_name') ||
      allMeta.includes('fname') ||
      allMeta.includes('имя')
    ) {
      return 'first_name';
    }

    if (
      autocomplete === 'family-name' ||
      allMeta.includes('lastname') ||
      allMeta.includes('last_name') ||
      allMeta.includes('lname') ||
      allMeta.includes('фамил')
    ) {
      return 'last_name';
    }

    // 5. Country
    if (
      autocomplete === 'country' ||
      autocomplete === 'country-name' ||
      allMeta.includes('country') ||
      allMeta.includes('страна')
    ) {
      return 'country';
    }

    // 6. City
    if (
      autocomplete === 'address-level2' ||
      allMeta.includes('city') ||
      allMeta.includes('город') ||
      allMeta.includes('town')
    ) {
      return 'city';
    }

    // 7. Street address
    if (
      autocomplete === 'street-address' ||
      autocomplete === 'address-line1' ||
      allMeta.includes('street') ||
      allMeta.includes('address') ||
      allMeta.includes('адрес') ||
      allMeta.includes('улица')
    ) {
      return 'street';
    }

    // 8. Postal code / ZIP
    if (
      autocomplete === 'postal-code' ||
      allMeta.includes('zip') ||
      allMeta.includes('postal') ||
      allMeta.includes('индекс') ||
      allMeta.includes('postcode')
    ) {
      return 'postal_code';
    }

    // 9. Phone
    if (
      type === 'tel' ||
      autocomplete === 'tel' ||
      allMeta.includes('phone') ||
      allMeta.includes('telephone') ||
      allMeta.includes('mobile') ||
      allMeta.includes('телефон')
    ) {
      return 'phone';
    }

    // 10. Terms / Marketing Checkboxes
    if (type === 'checkbox') {
      if (
        allMeta.includes('term') ||
        allMeta.includes('condition') ||
        allMeta.includes('agree') ||
        allMeta.includes('правил') ||
        allMeta.includes('соглас') ||
        allMeta.includes('услов')
      ) {
        return 'checkbox_terms';
      }
      return 'checkbox_marketing';
    }

    return 'unknown';
  }

  /**
   * Retrieves text label associated with an input.
   */
  private static getFieldLabel(input: HTMLInputElement): string {
    // 1. Direct label via `for` attribute
    if (input.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (labelEl?.textContent) {
        return labelEl.textContent.trim();
      }
    }

    // 2. Parent label element
    const parentLabel = input.closest('label');
    if (parentLabel?.textContent) {
      return parentLabel.textContent.trim();
    }

    // 3. ARIA attributes
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const el = document.getElementById(ariaLabelledBy);
      if (el?.textContent) return el.textContent.trim();
    }

    return '';
  }

  /**
   * Finds the most likely submit button in the container.
   */
  private static findSubmitButton(container: HTMLElement): HTMLElement | null {
    // 1. Submit inputs or buttons with type="submit"
    const submitBtn = container.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement;
    if (submitBtn) return submitBtn;

    // 2. Search all buttons by text
    const buttons = Array.from(container.querySelectorAll('button, a[role="button"], input[type="button"]'));
    const regPatterns = [
      /регистр/i,
      /зарегистр/i,
      /создать/i,
      /sign\s*up/i,
      /register/i,
      /create\s*(an?)?\s*account/i,
      /join/i,
      /get\s*started/i,
    ];

    for (const btn of buttons) {
      const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim();
      for (const pattern of regPatterns) {
        if (pattern.test(text)) {
          return btn as HTMLElement;
        }
      }
    }

    // Fallback: return the first button in container
    return (buttons[0] as HTMLElement) || null;
  }

  /**
   * Distinguishes a registration form from a pure login or password reset form.
   */
  private static isLikelyRegistration(detected: DetectedForm, container: HTMLElement): boolean {
    const hasEmail = detected.fields.some((f) => f.purpose === 'email');
    const hasPassword = detected.fields.some((f) => f.purpose === 'password');
    const hasConfirmPassword = detected.fields.some((f) => f.purpose === 'confirm_password');
    const hasTerms = detected.fields.some((f) => f.purpose === 'checkbox_terms');

    // If confirm password or terms checkbox is present, it's definitely registration
    if (hasConfirmPassword || hasTerms) {
      return true;
    }

    // Check button and container text
    const text = (container.textContent || '').toLowerCase();
    const isRegisterText =
      text.includes('регистрац') ||
      text.includes('создать аккаунт') ||
      text.includes('sign up') ||
      text.includes('create account') ||
      text.includes('join now');

    const isLoginOnlyText =
      (text.includes('sign in') ||
        text.includes('sign-in') ||
        text.includes('log in') ||
        text.includes('log-in') ||
        text.includes('login') ||
        text.includes('signin') ||
        text.includes('авторизац') ||
        text.includes('вход') ||
        text.includes('войти')) &&
      !isRegisterText;

    if (hasEmail && hasPassword && !isLoginOnlyText) {
      return true;
    }

    return isRegisterText && (hasEmail || hasPassword);
  }

  /**
   * Generates a stable CSS selector for an element.
   */
  public static getElementSelector(el: HTMLElement): string {
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }

    const name = el.getAttribute('name');
    if (name) {
      return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
    }

    // Path based selector
    const path: string[] = [];
    let current: HTMLElement | null = el;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }

      let selector = current.tagName.toLowerCase();
      let sibling = current;
      let nth = 1;
      while (sibling.previousElementSibling) {
        sibling = sibling.previousElementSibling as HTMLElement;
        if (sibling.tagName === current.tagName) nth++;
      }
      if (nth > 1) {
        selector += `:nth-of-type(${nth})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
}
