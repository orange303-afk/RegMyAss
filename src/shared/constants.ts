/**
 * QuickPass - Constants & Default Settings
 */

import { UserSettings } from './types';

export const DEFAULT_SETTINGS: UserSettings = {
  ownMail: { service: 'gmail', address: '' },
  autoSelectProvider: true,
  preferredProviderId: 'mail-tm',
  enabledProviders: ['mail-tm', 'mail-gw', 'dropmail', 'guerrilla'],
  providerApiKeys: {},
  passwordLength: 20,
  passwordRequireNumbers: true,
  passwordRequireSymbols: true,
  usernameTemplate: 'user_{random}',
  confirmBeforeSubmit: true,
  autoContinueAfterCaptcha: true,
  emailTimeoutSeconds: 180,
  reuseExistingAccount: true,
  storageMode: 'google_password_manager',
  autoLockMinutes: 15,
  isVaultConfigured: false,
  profile: {
    useCustomProfile: false,
    firstName: '',
    lastName: '',
    country: 'US',
    city: '',
    street: '',
    postalCode: '',
    phone: '',
  },
};

export const STORAGE_KEYS = {
  SETTINGS: 'quickpass_settings',
  ACTIVE_PROCESS: 'quickpass_active_process',
  VAULT_SALT: 'quickpass_vault_salt',
  VAULT_VERIFIER: 'quickpass_vault_verifier',
  DIAGNOSTIC_LOGS: 'quickpass_logs',
} as const;

export const ALARMS = {
  EMAIL_POLL: 'quickpass_email_poll',
  SESSION_TIMEOUT: 'quickpass_session_timeout',
  AUTO_LOCK: 'quickpass_auto_lock',
} as const;

export const EMAIL_POLL_INTERVAL_MS = 4000;
export const MAX_REGISTRATION_RETRIES = 2;
export const FORM_MUTATION_DEBOUNCE_MS = 250;
