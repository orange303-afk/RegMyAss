/**
 * QuickPass - Core Shared Types
 */

export type RegistrationState =
  | 'idle'
  | 'detecting'
  | 'creating_email'
  | 'filling_form'
  | 'awaiting_consent'
  | 'submitting'
  | 'awaiting_captcha'
  | 'awaiting_email'
  | 'verifying'
  | 'logging_in'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Mailbox {
  id: string;
  address: string;
  token?: string;
  password?: string;
  createdAt: number;
  expiresAt?: number;
  providerId: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  downloadUrl?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  receivedAt: number;
  attachments?: EmailAttachment[];
}

export interface EmailProviderCapabilities {
  createMailbox: boolean;
  readMessages: boolean;
  deleteMailbox: boolean;
  customDomain: boolean;
  requiresApiKey: boolean;
  supportsPush: boolean;
}

export interface EmailProvider {
  id: string;
  name: string;
  capabilities: EmailProviderCapabilities;

  isAvailable(): Promise<boolean>;
  createMailbox(): Promise<Mailbox>;
  getMessages(mailbox: Mailbox): Promise<EmailMessage[]>;
  getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage>;
  deleteMailbox?(mailbox: Mailbox): Promise<void>;
}

export type FieldPurpose =
  | 'email'
  | 'username'
  | 'password'
  | 'confirm_password'
  | 'first_name'
  | 'last_name'
  | 'country'
  | 'city'
  | 'street'
  | 'postal_code'
  | 'phone'
  | 'checkbox_terms'
  | 'checkbox_marketing'
  | 'unknown';

export interface FormFieldInfo {
  selector: string;
  purpose: FieldPurpose;
  required: boolean;
  type: string;
  name?: string;
  id?: string;
  placeholder?: string;
  label?: string;
  currentValue?: string;
}

export interface DetectedForm {
  formSelector?: string;
  isInsideModal: boolean;
  fields: FormFieldInfo[];
  submitButtonSelector?: string;
  verificationCodeRequestSelector?: string;
  captchaPresent: boolean;
  captchaType?: 'recaptcha-v2' | 'recaptcha-v3' | 'turnstile' | 'hcaptcha' | 'custom';
}

export interface UserProfile {
  useCustomProfile: boolean;
  firstName: string;
  lastName: string;
  country: string; // ISO 2 code e.g. 'US', 'DE', 'RU', 'GB'
  city: string;
  street: string;
  postalCode: string;
  phone: string;
}

export interface GeneratedAccountData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  street?: string;
  postalCode?: string;
  phone?: string;
  origin: string;
  providerId: string;
}

export interface StoredAccount {
  id: string;
  origin: string;
  email: string;
  username?: string;
  providerId: string;
  registrationState: 'completed' | 'pending_verification' | 'failed';
  createdAt: number;
  lastLoginAt: number;
  storageMode: 'google_password_manager' | 'encrypted_local';
  encryptedPassword?: string; // AES-GCM encrypted base64 if encrypted_local
  iv?: string; // base64
  salt?: string; // base64 KDF salt
  mailboxData?: {
    id: string;
    token?: string;
    password?: string;
  };
  notes?: string;
}

export interface ActiveProcess {
  processId: string;
  origin: string;
  tabId: number;
  frameId?: number;
  providerId: string;
  state: RegistrationState;
  startedAt: number;
  updatedAt: number;
  retryCount: number;
  lastError?: string;
  accountData?: GeneratedAccountData;
  mailbox?: Mailbox;
  detectedForm?: DetectedForm;
  emailBeforeSubmit?: boolean;
  verificationCode?: string;
  verificationLink?: string;
  emailWaitSeconds?: number;
}

export interface UserSettings {
  locale: 'en' | 'es' | 'ru';
  ownMail?: { address: string };
  autoSelectProvider: boolean;
  preferredProviderId: string;
  enabledProviders: string[];
  providerApiKeys: Record<string, string>;
  passwordLength: number;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  usernameTemplate: string; // e.g. 'user_{random}' or '{adjective}_{noun}_{num}'
  confirmBeforeSubmit: boolean;
  autoContinueAfterCaptcha: boolean;
  emailTimeoutSeconds: number;
  reuseExistingAccount: boolean;
  storageMode: 'google_password_manager' | 'encrypted_local';
  autoLockMinutes: number;
  isVaultConfigured: boolean;
  profile: UserProfile;
}

export interface DiagnosticLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: 'provider' | 'form' | 'captcha' | 'workflow' | 'storage';
  message: string;
  details?: Record<string, unknown>;
}
