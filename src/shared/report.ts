import { ActiveProcess } from './types';

const ISSUE_URL = 'https://github.com/orange303-afk/RegMyAss/issues/new';

/** Only structured, allowlisted facts go into the public issue draft. */
export function buildFailureReportUrl(process: ActiveProcess, version: string): string {
  const hostname = new URL(process.origin).hostname.toLowerCase();
  const safeVersion = /^\d+\.\d+\.\d+$/.test(version) ? version : 'unknown';
  const safeProvider = /^[a-z0-9-]{1,32}$/.test(process.providerId) ? process.providerId : 'unknown';
  const safeStage = /^[a-z_]{1,32}$/.test(process.failedAtState || '') ? process.failedAtState : 'unknown';
  const safeCode = /^[A-Z_]{1,40}$/.test(process.lastErrorCode || '') ? process.lastErrorCode : 'UNKNOWN_ERROR';
  const body = [
    '## Registration failure',
    '',
    `Site: ${hostname}`,
    `Extension version: ${safeVersion}`,
    `Stage: ${safeStage}`,
    `Error code: ${safeCode}`,
    `Email provider: ${safeProvider}`,
    '',
    '## What happened?',
    '<!-- Add a short description. Do not include passwords, email addresses, codes, or full URLs. -->',
    '',
    '## Expected result',
    '<!-- Describe what you expected. -->',
  ].join('\n');
  const url = new URL(ISSUE_URL);
  url.searchParams.set('title', `Registration failed on ${hostname}`);
  url.searchParams.set('body', body);
  return url.toString();
}
