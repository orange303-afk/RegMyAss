/**
 * QuickPass - CAPTCHA Detector
 * Identifies presence and resolution status of interactive CAPTCHA challenges.
 */

export type CaptchaType = 'recaptcha-v2' | 'turnstile' | 'hcaptcha' | 'generic';

export interface CaptchaStatus {
  present: boolean;
  type?: CaptchaType;
  resolved: boolean;
  element?: HTMLElement;
}

export class CaptchaDetector {
  /**
   * Scans document for active CAPTCHA elements and checks their resolution status.
   */
  public static detectCaptcha(): CaptchaStatus {
    // 1. Google reCAPTCHA v2
    const recaptchaContainer = document.querySelector(
      '.g-recaptcha, iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha/api2"]'
    ) as HTMLElement | null;

    if (recaptchaContainer) {
      const responseEl = document.querySelector('textarea[id*="g-recaptcha-response"]') as HTMLTextAreaElement | null;
      const isResolved = Boolean(responseEl && responseEl.value.trim().length > 0);
      return {
        present: true,
        type: 'recaptcha-v2',
        resolved: isResolved,
        element: recaptchaContainer,
      };
    }

    // 2. Cloudflare Turnstile
    const turnstileContainer = document.querySelector(
      '.cf-turnstile, iframe[src*="challenges.cloudflare.com"]'
    ) as HTMLElement | null;

    if (turnstileContainer) {
      const responseEl = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null;
      const isResolved = Boolean(responseEl && responseEl.value.trim().length > 0);
      return {
        present: true,
        type: 'turnstile',
        resolved: isResolved,
        element: turnstileContainer,
      };
    }

    // 3. hCaptcha
    const hcaptchaContainer = document.querySelector(
      '.h-captcha, iframe[src*="hcaptcha.com"]'
    ) as HTMLElement | null;

    if (hcaptchaContainer) {
      const responseEl = document.querySelector(
        'textarea[name="h-captcha-response"], input[name="h-captcha-response"]'
      ) as HTMLInputElement | null;
      const isResolved = Boolean(responseEl && responseEl.value.trim().length > 0);
      return {
        present: true,
        type: 'hcaptcha',
        resolved: isResolved,
        element: hcaptchaContainer,
      };
    }

    return { present: false, resolved: true };
  }

  /**
   * Starts polling for CAPTCHA resolution.
   */
  public static waitForResolution(
    onResolved: () => void,
    timeoutMs: number = 180000
  ): () => void {
    const startTime = Date.now();

    const intervalId = setInterval(() => {
      const status = this.detectCaptcha();

      if (!status.present || status.resolved) {
        clearInterval(intervalId);
        onResolved();
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }
}
