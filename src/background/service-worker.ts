/**
 * QuickPass - Background Service Worker
 * Manifest V3 entry point handling lifecycle, messaging, and automation orchestration.
 */

import { WorkflowManager } from './workflow-manager';
import { ProviderManager } from '../email/provider-manager';
import { VerificationManager } from '../email/verification-manager';
import { AccountManager } from '../accounts/account-manager';
import { AppDatabase } from '../storage/database';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import { ExtensionMessage } from '../shared/messages';
import { UserSettings } from '../shared/types';

// Instantiate singletons
const database = new AppDatabase();
const providerManager = new ProviderManager();
const verificationManager = new VerificationManager();
const accountManager = new AccountManager(database);
const workflowManager = new WorkflowManager(providerManager, verificationManager, accountManager);

// Restore state on worker initialization
const stateReady = workflowManager.restoreState().catch(console.error);
chrome.storage.local.remove(['regmyass_oauth_outlook', 'regmyass_oauth_gmail']).catch(console.error);
const MENU_ID = 'regmyass-open-window';
const WINDOW_WIDTH = 390;
const WINDOW_HEIGHT = 560;
type PointerPosition = Extract<ExtensionMessage, { type: 'POINTER_POSITION' }>['payload'];
const pointerPositions = new Map<number, Partial<Record<PointerPosition['source'], { position: PointerPosition; at: number }>>>();

async function getTargetTab(preferredTabId?: number): Promise<chrome.tabs.Tab | undefined> {
  if (preferredTabId) {
    try {
      return await chrome.tabs.get(preferredTabId);
    } catch {
      // The page may have been closed since the window was opened.
    }
  }

  const processTabId = workflowManager.getActiveProcess()?.tabId;
  if (processTabId) {
    try {
      return await chrome.tabs.get(processTabId);
    } catch {
      // Fall through to the active browser tab.
    }
  }

  const normalWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  if (!normalWindow?.id) return undefined;
  const [tab] = await chrome.tabs.query({ active: true, windowId: normalWindow.id });
  return tab;
}

async function openPersistentWindow(tabId?: number, source: PointerPosition['source'] = 'page-exit'): Promise<void> {
  const tab = await getTargetTab(tabId);
  const url = chrome.runtime.getURL(`popup.html${tab?.id ? `?tabId=${tab.id}` : ''}`);
  const popupBase = chrome.runtime.getURL('popup.html');
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
  const existing = windows.find((window) => window.tabs?.some((item) => item.url?.startsWith(popupBase)));

  if (existing?.id) {
    const existingTab = existing.tabs?.find((item) => item.url?.startsWith(popupBase));
    if (existingTab?.id && existingTab.url !== url) {
      await chrome.tabs.update(existingTab.id, { url });
    }
    await chrome.windows.update(existing.id, { focused: true });
    return;
  }

  const position = tab?.id ? pointerPositions.get(tab.id)?.[source] : undefined;
  let left: number | undefined;
  let top: number | undefined;
  if (position && Date.now() - position.at < 30_000) {
    const { screenX, screenY, availLeft, availTop, availWidth, availHeight } = position.position;
    if ([screenX, screenY, availLeft, availTop, availWidth, availHeight].every(Number.isFinite)) {
      left = Math.round(Math.max(availLeft, Math.min(screenX + 12, availLeft + availWidth - WINDOW_WIDTH)));
      top = Math.round(Math.max(availTop, Math.min(screenY + 12, availTop + availHeight - WINDOW_HEIGHT)));
    }
  }

  if (left === undefined && tab?.windowId) {
    const browserWindow = await chrome.windows.get(tab.windowId).catch(() => null);
    if (browserWindow?.left !== undefined && browserWindow.top !== undefined && browserWindow.width) {
      left = browserWindow.left + Math.max(0, browserWindow.width - WINDOW_WIDTH - 24);
      top = browserWindow.top + 56;
    }
  }

  await chrome.windows.create({
    url, type: 'popup', width: WINDOW_WIDTH, height: WINDOW_HEIGHT, focused: true,
    ...(left !== undefined && top !== undefined ? { left, top } : {}),
  });
}

function createContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'RegMyAss',
      contexts: ['page', 'selection', 'link', 'image', 'editable'],
      documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*'],
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.action.onClicked.addListener((tab) => {
  openPersistentWindow(tab.id).catch(console.error);
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) {
    openPersistentWindow(tab?.id, 'contextmenu').catch(console.error);
  }
});

async function getStoredSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) } as UserSettings;
  settings.ownMail = { address: settings.ownMail?.address || '' };
  return settings;
}

async function saveStoredSettings(newSettings: Partial<UserSettings>): Promise<void> {
  const current = await getStoredSettings();
  const updated = { ...current, ...newSettings };
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updated });
}

// Global message handler
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  (async () => {
    await stateReady;
    switch (message.type) {
      case 'POINTER_POSITION': {
        if (sender.tab?.id) {
          const current = pointerPositions.get(sender.tab.id) || {};
          current[message.payload.source] = { position: message.payload, at: Date.now() };
          pointerPositions.set(sender.tab.id, current);
        }
        sendResponse({ success: true });
        break;
      }
      case 'GET_STATE_REQUEST': {
        const settings = await getStoredSettings();
        let existingAccount = null;
        let currentOrigin = '';

        const tab = await getTargetTab(message.payload?.tabId);
        if (tab?.url) {
          try {
            const parsed = new URL(tab.url);
            if (['http:', 'https:', 'file:'].includes(parsed.protocol)) {
              currentOrigin = parsed.origin;
              existingAccount = await accountManager.getExistingAccount(currentOrigin);
            }
          } catch {
            // invalid url
          }
        }

        sendResponse({
          type: 'GET_STATE_RESPONSE',
          payload: {
            activeProcess: workflowManager.getActiveProcess(),
            settings,
            existingAccount,
            currentOrigin,
            currentTabId: currentOrigin ? tab?.id || 0 : 0,
          },
        });
        break;
      }

      case 'START_REGISTRATION': {
        const settings = await getStoredSettings();
        workflowManager.startRegistration(
          message.payload.origin,
          message.payload.tabId,
          settings,
          message.payload.providerId
        );
        sendResponse({ success: true });
        break;
      }

      case 'CONFIRM_SUBMIT': {
        const settings = await getStoredSettings();
        workflowManager.continueSubmission(settings);
        sendResponse({ success: true });
        break;
      }

      case 'CANCEL_PROCESS': {
        await workflowManager.cancelProcess();
        sendResponse({ success: true });
        break;
      }

      case 'MANUAL_CAPTCHA_DONE':
      case 'CAPTCHA_RESOLVED': {
        const settings = await getStoredSettings();
        workflowManager.resumeAfterCaptcha(settings);
        sendResponse({ success: true });
        break;
      }

      case 'MANUAL_COMPLETE_EMAIL': {
        const settings = await getStoredSettings();
        await workflowManager.manualCompleteEmail(settings, message.payload?.code);
        sendResponse({ success: true });
        break;
      }

      case 'SIMULATE_TEST_EMAIL': {
        const settings = await getStoredSettings();
        await workflowManager.simulateTestEmail(settings);
        sendResponse({ success: true });
        break;
      }

      case 'GET_INBOX_MESSAGES_REQUEST': {
        const process = workflowManager.getActiveProcess();
        if (process?.mailbox) {
          const prov = providerManager.getProvider(process.providerId);
          if (prov) {
            try {
              const messages = await prov.getMessages(process.mailbox);
              sendResponse({ success: true, payload: { messages } });
              return;
            } catch (err: any) {
              sendResponse({ success: false, error: err.message, payload: { messages: [] } });
              return;
            }
          }
        }
        sendResponse({ success: true, payload: { messages: [] } });
        break;
      }

      case 'GET_FULL_MESSAGE_REQUEST': {
        const process = workflowManager.getActiveProcess();
        if (process?.mailbox) {
          const prov = providerManager.getProvider(process.providerId);
          if (prov) {
            try {
              const fullMsg = await prov.getMessage(process.mailbox, message.payload.messageId);
              sendResponse({ success: true, payload: { message: fullMsg } });
              return;
            } catch (err: any) {
              sendResponse({ success: false, error: err.message });
              return;
            }
          }
        }
        sendResponse({ success: false, error: 'No active mailbox' });
        break;
      }

      case 'RETRY_FILL_OTP': {
        const process = workflowManager.getActiveProcess();
        if (process?.tabId) {
          await workflowManager.sendTabMessageWithInjection(process.tabId, {
            type: 'ENTER_VERIFICATION_CODE_REQUEST',
            payload: { code: message.payload.code },
          });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
        break;
      }

      case 'LOGIN_EXISTING_ACCOUNT': {
        const acc = await database.getAccountById(message.payload.accountId);
        if (acc) {
          // Send login command to content script
          chrome.tabs.sendMessage(message.payload.tabId, {
            type: 'FILL_FORM_REQUEST',
            payload: {
              accountData: {
                email: acc.email,
                username: acc.username || '',
                password: '', // filled from browser password manager
                origin: acc.origin,
                providerId: acc.providerId,
              },
              fields: [
                { selector: 'input[type="email"], input[name*="user"], input[name*="email"]', purpose: 'email' },
              ],
            },
          }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
      }

      case 'GET_SETTINGS_REQUEST': {
        const settings = await getStoredSettings();
        sendResponse({ type: 'GET_SETTINGS_RESPONSE', payload: settings });
        break;
      }

      case 'UPDATE_SETTINGS_REQUEST': {
        await saveStoredSettings(message.payload);
        sendResponse({ type: 'UPDATE_SETTINGS_RESPONSE', payload: { success: true } });
        break;
      }

      case 'TEST_PROVIDER_REQUEST': {
        const prov = providerManager.getProvider(message.payload.providerId);
        if (!prov) {
          sendResponse({
            type: 'TEST_PROVIDER_RESPONSE',
            payload: { success: false, error: 'Провайдер не найден' },
          });
          return;
        }

        try {
          const isOk = await prov.isAvailable();
          if (!isOk) {
            sendResponse({
              type: 'TEST_PROVIDER_RESPONSE',
              payload: { success: false, error: 'Сервер недоступен или вернул ошибку' },
            });
            return;
          }

          const mailbox = await prov.createMailbox();
          sendResponse({
            type: 'TEST_PROVIDER_RESPONSE',
            payload: { success: true, mailboxAddress: mailbox.address },
          });
        } catch (err: any) {
          sendResponse({
            type: 'TEST_PROVIDER_RESPONSE',
            payload: { success: false, error: err.message },
          });
        }
        break;
      }

      default:
        break;
    }
  })().catch((err) => {
    console.error('Background message failed:', err);
    sendResponse({ success: false, error: err?.message || 'Ошибка обработки запроса' });
  });

  return true; // Keep channel open for async response
});

// Watch tab closure to cancel orphaned process
chrome.tabs.onRemoved.addListener((closedTabId) => {
  const process = workflowManager.getActiveProcess();
  if (process && process.tabId === closedTabId) {
    workflowManager.cancelProcess();
  }
});
