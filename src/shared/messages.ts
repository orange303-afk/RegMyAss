/**
 * QuickPass - Type-Safe Extension Messaging
 */

import {
  ActiveProcess,
  DetectedForm,
  FieldPurpose,
  GeneratedAccountData,
  RegistrationState,
  StoredAccount,
  UserSettings,
} from './types';

export type ExtensionMessage =
  // Content Script <-> Background
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'CONTENT_READY'; payload: { origin: string } }
  | { type: 'POINTER_POSITION'; payload: {
      source: 'contextmenu' | 'page-exit';
      screenX: number;
      screenY: number;
      availLeft: number;
      availTop: number;
      availWidth: number;
      availHeight: number;
    } }
  | { type: 'SCAN_PAGE_REQUEST' }
  | {
      type: 'SCAN_PAGE_RESPONSE';
      payload: { form: DetectedForm | null; hasExistingSession: boolean };
    }
  | {
      type: 'FILL_FORM_REQUEST';
      payload: {
        accountData: GeneratedAccountData;
        fields: Array<{ selector: string; purpose: FieldPurpose }>;
      };
    }
  | { type: 'FILL_FORM_RESPONSE'; payload: { success: boolean; error?: string } }
  | { type: 'SUBMIT_FORM_REQUEST'; payload: { submitSelector?: string } }
  | { type: 'SUBMIT_FORM_RESPONSE'; payload: { success: boolean; error?: string } }
  | { type: 'REQUEST_VERIFICATION_CODE'; payload: { selector: string } }
  | { type: 'CAPTCHA_DETECTED'; payload: { captchaType: string } }
  | { type: 'CAPTCHA_RESOLVED' }
  | { type: 'ENTER_VERIFICATION_CODE_REQUEST'; payload: { code: string } }
  | { type: 'ENTER_VERIFICATION_CODE_RESPONSE'; payload: { success: boolean } }

  // Popup / UI <-> Background
  | { type: 'GET_STATE_REQUEST'; payload?: { tabId?: number } }
  | {
      type: 'GET_STATE_RESPONSE';
      payload: {
        activeProcess: ActiveProcess | null;
        settings: UserSettings;
        existingAccount: StoredAccount | null;
        currentOrigin: string;
        currentTabId: number;
      };
    }
  | { type: 'START_REGISTRATION'; payload: { origin: string; tabId: number; providerId?: string } }
  | { type: 'CONFIRM_SUBMIT'; payload: { processId: string } }
  | { type: 'CANCEL_PROCESS'; payload: { processId: string } }
  | { type: 'MANUAL_COMPLETE_EMAIL'; payload?: { code?: string } }
  | { type: 'SIMULATE_TEST_EMAIL' }
  | { type: 'GET_INBOX_MESSAGES_REQUEST' }
  | { type: 'GET_FULL_MESSAGE_REQUEST'; payload: { messageId: string } }
  | { type: 'RETRY_FILL_OTP'; payload: { code: string } }
  | { type: 'LOGIN_EXISTING_ACCOUNT'; payload: { accountId: string; tabId: number } }
  | { type: 'MANUAL_CAPTCHA_DONE'; payload: { processId: string } }

  // Options <-> Background
  | { type: 'GET_SETTINGS_REQUEST' }
  | { type: 'GET_SETTINGS_RESPONSE'; payload: UserSettings }
  | { type: 'UPDATE_SETTINGS_REQUEST'; payload: Partial<UserSettings> }
  | { type: 'UPDATE_SETTINGS_RESPONSE'; payload: { success: boolean } }
  | { type: 'GET_ACCOUNTS_REQUEST' }
  | { type: 'GET_ACCOUNTS_RESPONSE'; payload: StoredAccount[] }
  | { type: 'DELETE_ACCOUNT_REQUEST'; payload: { id: string } }
  | { type: 'DELETE_ACCOUNT_RESPONSE'; payload: { success: boolean } }
  | { type: 'TEST_PROVIDER_REQUEST'; payload: { providerId: string } }
  | { type: 'CONNECT_OWN_MAIL'; payload: { service: 'gmail' } }
  | { type: 'GET_OAUTH_CONFIG' }
  | { type: 'DISCONNECT_OWN_MAIL'; payload: { service: 'gmail' } }
  | { type: 'GET_OWN_MAIL_CONNECTION'; payload: { service: 'gmail' } }
  | {
      type: 'TEST_PROVIDER_RESPONSE';
      payload: { success: boolean; mailboxAddress?: string; error?: string };
    }

  // State broadcasts
  | { type: 'STATE_CHANGED'; payload: { state: RegistrationState; process: ActiveProcess | null } };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
