/**
 * QuickPass - Registration Workflow Manager
 * State machine managing automated account registration with Manifest V3 lifecycle persistence.
 */

import {
  ActiveProcess,
  GeneratedAccountData,
  RegistrationState,
  UserSettings,
} from '../shared/types';
import { ProviderManager } from '../email/provider-manager';
import { VerificationManager } from '../email/verification-manager';
import { AccountGenerator } from '../accounts/account-generator';
import { AccountManager } from '../accounts/account-manager';
import { STORAGE_KEYS } from '../shared/constants';
import { QuickPassError } from '../shared/errors';
import { OwnMailProvider } from '../email/own-mail';
import { t } from '../shared/i18n';

export class WorkflowManager {
  private activeProcess: ActiveProcess | null = null;
  private providerManager: ProviderManager;
  private verificationManager: VerificationManager;
  private accountManager: AccountManager;

  constructor(
    providerManager: ProviderManager = new ProviderManager(),
    verificationManager: VerificationManager = new VerificationManager(),
    accountManager: AccountManager = new AccountManager()
  ) {
    this.providerManager = providerManager;
    this.verificationManager = verificationManager;
    this.accountManager = accountManager;
  }

  public getActiveProcess(): ActiveProcess | null {
    return this.activeProcess;
  }

  /**
   * Restores in-flight process state from storage after service worker wake-up.
   */
  public async restoreState(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_PROCESS);
      if (data[STORAGE_KEYS.ACTIVE_PROCESS]) {
        this.activeProcess = data[STORAGE_KEYS.ACTIVE_PROCESS] as ActiveProcess;
      }
    } catch (e) {
      console.warn('Failed to restore process state:', e);
    }
  }

  /**
   * Persists state to storage and broadcasts change to extension views.
   */
  private async updateState(state: RegistrationState, updates: Partial<ActiveProcess> = {}): Promise<void> {
    if (!this.activeProcess) return;

    this.activeProcess = {
      ...this.activeProcess,
      ...updates,
      state,
      updatedAt: Date.now(),
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.ACTIVE_PROCESS]: this.activeProcess,
    });

    this.broadcastState();
  }

  private broadcastState(): void {
    if (!this.activeProcess) return;
    try {
      Promise.resolve(
        chrome.runtime.sendMessage({
          type: 'STATE_CHANGED',
          payload: { state: this.activeProcess.state, process: this.activeProcess },
        })
      ).catch(() => {
        // Ignore errors when no popup is open
      });
    } catch {
      // Ignore sync messaging errors
    }
  }

  /**
   * Safely sends message to content script, dynamically injecting content.js if missing.
   */
  public async sendTabMessageWithInjection(tabId: number, message: any, frameId = this.activeProcess?.frameId): Promise<any> {
    try {
      return await chrome.tabs.sendMessage(tabId, message, frameId === undefined ? undefined : { frameId });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('Receiving end does not exist') ||
        errMsg.includes('Could not establish connection')
      ) {
        try {
          if (chrome.scripting?.executeScript) {
            await chrome.scripting.executeScript({
              target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
              files: ['content.js'],
            });
            await new Promise((res) => setTimeout(res, 200));
            return await chrome.tabs.sendMessage(tabId, message, frameId === undefined ? undefined : { frameId });
          }
        } catch (injectionErr: any) {
          throw new QuickPassError({
            code: 'TAB_CLOSED',
            userMessage:
              'Не удалось подключиться к странице. Пожалуйста, обновите вкладку (F5 / Cmd+R). Если вы открыли локальный файл (file://), разрешите расширению доступ к файловым ссылкам в chrome://extensions либо откройте тест через локальный сервер (http://localhost:8080).',
            recoverable: true,
            technicalMessage: injectionErr.message,
          });
        }
      }
      throw err;
    }
  }

  private async scanRegistrationForm(tabId: number): Promise<{ form: any; frameId: number } | null> {
    const frames = await chrome.webNavigation.getAllFrames({ tabId }) || [{ frameId: 0 }];
    for (const frame of frames) {
      try {
        const response = await this.sendTabMessageWithInjection(tabId, { type: 'SCAN_PAGE_REQUEST' }, frame.frameId);
        if (response?.payload?.form?.fields?.length) {
          return { form: response.payload.form, frameId: frame.frameId };
        }
      } catch (error) {
        console.warn(`Could not scan frame ${frame.frameId}:`, error);
      }
    }
    return null;
  }

  /**
   * Starts registration workflow.
   */
  public async startRegistration(
    origin: string,
    tabId: number,
    settings: UserSettings,
    preferredProviderId?: string
  ): Promise<void> {
    const processId = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    this.activeProcess = {
      processId,
      origin,
      tabId,
      providerId: preferredProviderId || settings.preferredProviderId,
      state: 'detecting',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
    };

    await this.updateState('detecting');

    try {
      // 1. Scan page for form (with dynamic script injection if needed)
      const scanResult = await this.scanRegistrationForm(tabId);
      const detectedForm = scanResult?.form;

      if (!detectedForm || detectedForm.fields.length === 0) {
        throw new QuickPassError({
          code: 'FORM_NOT_FOUND',
          userMessage: 'Форма регистрации на странице не обнаружена.',
          recoverable: false,
        });
      }

      await this.updateState('creating_email', { detectedForm, frameId: scanResult!.frameId });

      // 2. Use the connected address, or create a temporary mailbox.
      const useOwnMail = preferredProviderId === 'own-mail' ||
        (!preferredProviderId && !settings.autoSelectProvider && settings.preferredProviderId === 'own-mail');
      const { mailbox, provider } = useOwnMail
        ? { mailbox: await (this.providerManager.getProvider('own-mail') as OwnMailProvider).mailbox(settings), provider: { id: 'own-mail' } }
        : await this.providerManager.createMailboxWithFailover({
            ...settings,
            ...(preferredProviderId ? { autoSelectProvider: false, preferredProviderId } : {}),
          });
      await this.updateState('filling_form', { mailbox, providerId: provider.id });

      // 3. Generate account data
      const accountData: GeneratedAccountData = AccountGenerator.generateAccountData(
        mailbox.address,
        origin,
        provider.id,
        settings
      );

      // 4. Fill form fields
      const fillResponse: any = await this.sendTabMessageWithInjection(tabId, {
        type: 'FILL_FORM_REQUEST',
        payload: {
          accountData,
          fields: detectedForm.fields,
        },
      });

      if (!fillResponse?.payload?.success) {
        throw new QuickPassError({
          code: 'MISSING_REQUIRED_FIELD',
          userMessage: 'Не удалось заполнить поля регистрационной формы.',
          recoverable: true,
        });
      }

      await this.updateState('filling_form', { accountData });

      if (detectedForm.verificationCodeRequestSelector) {
        await this.updateState('filling_form', { emailBeforeSubmit: true });
        const request = await this.sendTabMessageWithInjection(tabId, {
          type: 'REQUEST_VERIFICATION_CODE',
          payload: { selector: detectedForm.verificationCodeRequestSelector },
        });
        if (!request?.success) {
          throw new Error('Не удалось запросить код подтверждения на странице.');
        }
        await this.startEmailVerification(settings);
        return;
      }

      // 5. Check if user consent is needed before submitting
      if (settings.confirmBeforeSubmit) {
        await this.updateState('awaiting_consent');
        return; // Await user click in popup
      }

      await this.continueSubmission(settings);
    } catch (err: any) {
      await this.handleWorkflowError(err);
    }
  }

  /**
   * Continues submission after consent.
   */
  public async continueSubmission(settings: UserSettings): Promise<void> {
    if (!this.activeProcess || !this.activeProcess.detectedForm) return;

    try {
      await this.updateState('submitting');

      // Check if CAPTCHA is already visible
      if (this.activeProcess.detectedForm.captchaPresent) {
        await this.handleCaptchaWait();
        return;
      }

      // Submit form
      const submitResponse: any = await this.sendTabMessageWithInjection(this.activeProcess.tabId, {
        type: 'SUBMIT_FORM_REQUEST',
        payload: { submitSelector: this.activeProcess.detectedForm.submitButtonSelector },
      });

      if (!submitResponse?.payload?.success) {
        console.warn('Direct submit button click returned false, waiting for form events...');
      }

      // Small pause to allow CAPTCHA challenge or page transition to appear
      await new Promise((res) => setTimeout(res, 2000));

      // Re-scan for post-submit CAPTCHA
      const postScan: any = await this.sendTabMessageWithInjection(this.activeProcess.tabId, {
        type: 'SCAN_PAGE_REQUEST',
      }).catch(() => null);
      if (postScan?.payload?.form?.captchaPresent) {
        await this.handleCaptchaWait();
        return;
      }

      if (this.activeProcess.emailBeforeSubmit) {
        await this.finalizeRegistration(settings);
      } else {
        await this.startEmailVerification(settings);
      }
    } catch (err: any) {
      await this.handleWorkflowError(err);
    }
  }

  /**
   * Handles CAPTCHA challenge pause and tab activation.
   */
  public async handleCaptchaWait(): Promise<void> {
    if (!this.activeProcess) return;

    await this.updateState('awaiting_captcha');

    // Bring tab to focus
    await chrome.tabs.update(this.activeProcess.tabId, { active: true });

    // Show desktop notification
    const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const locale = (stored[STORAGE_KEYS.SETTINGS] as UserSettings | undefined)?.locale;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: t(locale, 'RegMyAss: Требуется CAPTCHA'),
      message: t(locale, 'Пожалуйста, решите капчу на открытой вкладке для продолжения регистрации.'),
    });
  }

  /**
   * Resumes workflow after user solves CAPTCHA.
   */
  public async resumeAfterCaptcha(settings: UserSettings): Promise<void> {
    if (!this.activeProcess) return;
    if (this.activeProcess.emailBeforeSubmit) {
      await this.finalizeRegistration(settings);
    } else {
      await this.startEmailVerification(settings);
    }
  }

  /**
   * Waits for verification email, processes code or link, and saves account.
   */
  public async startEmailVerification(settings: UserSettings): Promise<void> {
    if (!this.activeProcess || !this.activeProcess.mailbox || !this.activeProcess.accountData) return;

    await this.updateState('awaiting_email');

    if (this.activeProcess.mailbox.id.startsWith('manual:')) {
      return;
    }


    const provider = this.providerManager.getProvider(this.activeProcess.providerId);
    if (!provider) {
      throw new QuickPassError({
        code: 'PROVIDER_UNAVAILABLE',
        userMessage: 'Почтовый сервис недоступен для проверки входящих сообщений.',
        recoverable: false,
      });
    }

    try {
      const result = await this.verificationManager.waitForVerification({
        mailbox: this.activeProcess.mailbox,
        provider,
        startedAt: this.activeProcess.startedAt,
        timeoutSeconds: settings.emailTimeoutSeconds,
        targetOrigin: this.activeProcess.origin,
        onProgress: (elapsed) => {
          this.updateState('awaiting_email', { emailWaitSeconds: elapsed });
        },
      });

      await this.updateState('verifying', {
        verificationCode: result.verification.code,
        verificationLink: result.verification.link,
      });

      // If OTP code: enter into page
      if (result.verification.code) {
        await this.sendTabMessageWithInjection(this.activeProcess.tabId, {
          type: 'ENTER_VERIFICATION_CODE_REQUEST',
          payload: { code: result.verification.code },
        }).catch(() => {});
      }

      // If link: activate link in tab or background
      if (result.verification.link) {
        await chrome.tabs.create({ url: result.verification.link, active: false });
      }

      if (this.activeProcess.emailBeforeSubmit) {
        if (settings.confirmBeforeSubmit) {
          await this.updateState('awaiting_consent');
        } else {
          await this.continueSubmission(settings);
        }
        return;
      }

      await this.finalizeRegistration(settings);
    } catch (err: any) {
      await this.handleWorkflowError(err);
    }
  }

  /**
   * Finalizes registration by saving account and showing notification.
   */
  public async finalizeRegistration(settings: UserSettings): Promise<void> {
    if (!this.activeProcess || !this.activeProcess.accountData || !this.activeProcess.mailbox) return;

    await this.updateState('logging_in');

    // Save account record
    await this.accountManager.saveAccount(
      this.activeProcess.accountData,
      this.activeProcess.mailbox,
      settings
    );

    await this.updateState('completed');

    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: t(settings.locale, 'RegMyAss: Регистрация завершена!'),
      message: settings.locale === 'es' ? `Cuenta ${this.activeProcess.accountData.email} creada correctamente.` : `Account ${this.activeProcess.accountData.email} created successfully.`,
    });
  }

  /**
   * Manually completes email step if user verified manually or clicked link elsewhere.
   */
  public async manualCompleteEmail(settings: UserSettings, code?: string): Promise<void> {
    if (!this.activeProcess) return;

    if (code) {
      await this.sendTabMessageWithInjection(this.activeProcess.tabId, {
        type: 'ENTER_VERIFICATION_CODE_REQUEST',
        payload: { code },
      }).catch(() => {});
    }

    if (this.activeProcess.emailBeforeSubmit) {
      await this.updateState('awaiting_consent', { verificationCode: code });
      return;
    }

    await this.finalizeRegistration(settings);
  }

  /**
   * Simulates incoming verification email for testing and instant completion.
   */
  public async simulateTestEmail(settings: UserSettings): Promise<void> {
    if (!this.activeProcess) return;

    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    await this.updateState('verifying', { verificationCode: mockCode });

    await this.sendTabMessageWithInjection(this.activeProcess.tabId, {
      type: 'ENTER_VERIFICATION_CODE_REQUEST',
      payload: { code: mockCode },
    }).catch(() => {});

    await this.finalizeRegistration(settings);
  }

  /**
   * Cancels active process.
   */
  public async cancelProcess(): Promise<void> {
    if (!this.activeProcess) return;
    await this.updateState('cancelled');
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_PROCESS);
    this.activeProcess = null;
    this.broadcastState();
  }

  private async handleWorkflowError(err: any): Promise<void> {
    const message = err.userMessage || err.message || 'Неизвестная ошибка регистрации';
    console.error('Workflow error:', err);

    if (this.activeProcess) {
      await this.updateState('failed', {
        lastError: message,
        lastErrorCode: err instanceof QuickPassError ? err.code : 'UNKNOWN_ERROR',
        failedAtState: this.activeProcess.state,
      });
    }
  }
}
