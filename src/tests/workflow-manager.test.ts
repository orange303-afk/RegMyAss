import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowManager } from '../background/workflow-manager';
import { ProviderManager } from '../email/provider-manager';
import { VerificationManager } from '../email/verification-manager';
import { AccountManager } from '../accounts/account-manager';
import { DEFAULT_SETTINGS } from '../shared/constants';

describe('WorkflowManager', () => {
  let workflowManager: WorkflowManager;
  let mockProviderManager: any;
  let mockVerificationManager: any;
  let mockAccountManager: any;

  beforeEach(() => {
    mockProviderManager = {
      getProvider: vi.fn(),
      createMailboxWithFailover: vi.fn().mockResolvedValue({
        mailbox: {
          id: 'mb_1',
          address: 'test@mail.tm',
          token: 'tok_1',
          createdAt: Date.now(),
          providerId: 'mail-tm',
        },
        provider: { id: 'mail-tm', name: 'Mail.tm' },
      }),
    };

    mockVerificationManager = {
      waitForVerification: vi.fn().mockResolvedValue({
        message: { id: 'msg_1', subject: 'Verify' },
        verification: { type: 'code', code: '123456', confidence: 0.9 },
      }),
    };

    mockAccountManager = {
      saveAccount: vi.fn().mockResolvedValue({}),
      getExistingAccount: vi.fn().mockResolvedValue(null),
    };

    workflowManager = new WorkflowManager(
      mockProviderManager as unknown as ProviderManager,
      mockVerificationManager as unknown as VerificationManager,
      mockAccountManager as unknown as AccountManager
    );
  });

  it('initializes in idle state', () => {
    expect(workflowManager.getActiveProcess()).toBeNull();
  });

  it('cancels process cleanly', async () => {
    // Inject active process
    (workflowManager as any).activeProcess = {
      processId: 'p_1',
      state: 'awaiting_captcha',
      origin: 'https://example.com',
      tabId: 1,
      providerId: 'mail-tm',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
    };

    await workflowManager.cancelProcess();
    expect(workflowManager.getActiveProcess()).toBeNull();
  });

  it('finds a registration form in a child frame', async () => {
    (chrome as any).webNavigation = {
      getAllFrames: vi.fn().mockResolvedValue([{ frameId: 0 }, { frameId: 7 }]),
    };
    const send = vi.spyOn(chrome.tabs, 'sendMessage').mockImplementation(async (_tabId, _message, options) => {
      if (options?.frameId === 7) return { payload: { form: { fields: [{ purpose: 'email', selector: '#num' }] } } };
      return { payload: { form: null } };
    });
    const result = await (workflowManager as any).scanRegistrationForm(1);
    expect(result.frameId).toBe(7);
    expect(send).toHaveBeenCalledWith(1, { type: 'SCAN_PAGE_REQUEST' }, { frameId: 7 });
    send.mockRestore();
  });

  it('waits for form submission when the email code is required first', async () => {
    (workflowManager as any).activeProcess = {
      processId: 'staged', origin: 'https://example.com', tabId: 1, frameId: 7,
      providerId: 'mail-tm', state: 'awaiting_email', startedAt: Date.now(), updatedAt: Date.now(), retryCount: 0,
      emailBeforeSubmit: true,
      mailbox: { id: 'mb_1', address: 'test@mail.tm', providerId: 'mail-tm', createdAt: Date.now() },
      accountData: { email: 'test@mail.tm', username: 'test', password: 'password', origin: 'https://example.com', providerId: 'mail-tm' },
      detectedForm: { fields: [], submitButtonSelector: '#submit' },
    };
    mockProviderManager.getProvider.mockReturnValue({ id: 'mail-tm' });
    await workflowManager.startEmailVerification({ ...DEFAULT_SETTINGS, confirmBeforeSubmit: true });
    expect(workflowManager.getActiveProcess()?.state).toBe('awaiting_consent');
    expect(mockAccountManager.saveAccount).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'ENTER_VERIFICATION_CODE_REQUEST', payload: { code: '123456' },
    }, { frameId: 7 });
  });
});
