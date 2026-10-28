/**
 * QuickPass - Content Script
 * Injected into target websites to scan, fill forms, and detect CAPTCHA challenges.
 */

import { FormDetector } from './form-detector';
import { FormFiller } from './form-filler';
import { LoginDetector } from './login-detector';
import { CaptchaDetector } from './captcha-detector';
import { DomObserver } from './dom-observer';
import { ExtensionMessage } from '../shared/messages';

(function initQuickPassContent() {
  if ((window as Window & { __regmyassContentReady?: boolean }).__regmyassContentReady) return;
  (window as Window & { __regmyassContentReady?: boolean }).__regmyassContentReady = true;
  const domObserver = new DomObserver();

  const rememberPointer = (event: MouseEvent, source: 'contextmenu' | 'page-exit') => {
    const display = screen as Screen & { availLeft?: number; availTop?: number };
    chrome.runtime.sendMessage({
      type: 'POINTER_POSITION',
      payload: {
        source,
        screenX: event.screenX,
        screenY: event.screenY,
        availLeft: display.availLeft ?? 0,
        availTop: display.availTop ?? 0,
        availWidth: display.availWidth,
        availHeight: display.availHeight,
      },
    }).catch(() => {});
  };

  // A context-menu click gives an exact position. Leaving the page gives the
  // closest available position before a click on Chrome's toolbar.
  document.addEventListener('contextmenu', (event) => rememberPointer(event, 'contextmenu'), { capture: true });
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) rememberPointer(event, 'page-exit');
  }, { capture: true });

  // Notify background script that content script is active
  try {
    chrome.runtime.sendMessage({
      type: 'CONTENT_READY',
      payload: { origin: window.location.origin },
    });
  } catch {
    // Ignore if background not yet listening
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'PING': {
        sendResponse({ type: 'PONG' });
        return true;
      }

      case 'SCAN_PAGE_REQUEST': {
        const form = FormDetector.detectRegistrationForm();
        const hasExistingSession = LoginDetector.hasActiveSession();
        sendResponse({
          type: 'SCAN_PAGE_RESPONSE',
          payload: { form, hasExistingSession },
        });
        return true;
      }

      case 'FILL_FORM_REQUEST': {
        const { accountData, fields } = message.payload;
        const success = FormFiller.fillForm(accountData, fields);
        sendResponse({ type: 'FILL_FORM_RESPONSE', payload: { success } });
        return true;
      }

      case 'SUBMIT_FORM_REQUEST': {
        const success = FormFiller.submitForm(message.payload.submitSelector);
        sendResponse({ type: 'SUBMIT_FORM_RESPONSE', payload: { success } });
        return true;
      }

      case 'REQUEST_VERIFICATION_CODE': {
        const button = document.querySelector(message.payload.selector) as HTMLElement | null;
        if (button) button.click();
        sendResponse({ success: Boolean(button) });
        return true;
      }

      case 'ENTER_VERIFICATION_CODE_REQUEST': {
        const { code } = message.payload;
        const success = FormFiller.fillOtpCode(code);
        sendResponse({ type: 'ENTER_VERIFICATION_CODE_RESPONSE', payload: { success } });
        return true;
      }

      default:
        break;
    }
    return false;
  });

  // Watch for dynamic DOM changes (SPAs, React modals)
  domObserver.start(() => {
    // If a captcha was just resolved, notify background
    const captcha = CaptchaDetector.detectCaptcha();
    if (captcha.present && captcha.resolved) {
      chrome.runtime.sendMessage({ type: 'CAPTCHA_RESOLVED' }).catch(() => {});
    }
  });
})();
