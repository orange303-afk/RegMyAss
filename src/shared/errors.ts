/**
 * QuickPass - Structured Error Management
 */

export type ErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MAILBOX_CREATION_FAILED'
  | 'EMAIL_REJECTED'
  | 'FORM_NOT_FOUND'
  | 'MISSING_REQUIRED_FIELD'
  | 'PASSWORD_POLICY_MISMATCH'
  | 'ACCOUNT_ALREADY_EXISTS'
  | 'CAPTCHA_REQUIRED'
  | 'CAPTCHA_CANCELLED'
  | 'EMAIL_TIMEOUT'
  | 'INVALID_VERIFICATION_LINK'
  | 'AUTH_FAILED'
  | 'TAB_CLOSED'
  | 'PERMISSION_DENIED'
  | 'STORAGE_LOCKED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface QuickPassErrorDetails {
  code: ErrorCode;
  userMessage: string;
  technicalMessage?: string;
  recoverable: boolean;
  suggestedAction?: 'retry' | 'switch_provider' | 'solve_captcha' | 'manual_input' | 'unlock_vault';
}

export class QuickPassError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly recoverable: boolean;
  public readonly suggestedAction?: QuickPassErrorDetails['suggestedAction'];

  constructor(details: QuickPassErrorDetails) {
    super(details.technicalMessage || details.userMessage);
    this.name = 'QuickPassError';
    this.code = details.code;
    this.userMessage = details.userMessage;
    this.recoverable = details.recoverable;
    this.suggestedAction = details.suggestedAction;
  }
}

export function createError(
  code: ErrorCode,
  userMessage: string,
  options?: Partial<QuickPassErrorDetails>
): QuickPassError {
  return new QuickPassError({
    code,
    userMessage,
    recoverable: options?.recoverable ?? false,
    suggestedAction: options?.suggestedAction,
    technicalMessage: options?.technicalMessage,
  });
}
