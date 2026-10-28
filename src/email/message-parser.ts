/**
 * QuickPass - Secure Email Message Parser
 * Safely extracts verification links and OTP codes without executing JavaScript.
 */

import { EmailMessage } from '../shared/types';

export interface VerificationData {
  type: 'link' | 'code' | 'none';
  link?: string;
  code?: string;
  confidence: number; // 0 to 1
}

export class MessageParser {
  private static readonly LINK_KEYWORDS = [
    'confirm',
    'verify',
    'activate',
    'activation',
    'verification',
    'validation',
    'validate',
    'complete',
    'token',
    'auth',
  ];

  private static readonly BUTTON_TEXT_PATTERNS = [
    /подтверд/i,
    /активир/i,
    /верифи/i,
    /завершить регистрацию/i,
    /confirm\s*(my)?\s*email/i,
    /verify\s*(my)?\s*(email|account)/i,
    /activate\s*(my)?\s*account/i,
    /complete\s*registration/i,
  ];

  private static readonly OTP_PATTERNS = [
    /(?:login\s*code|verification\s*code|activation\s*code|security\s*code|one-time\s*code|passcode|код(?: подтверждения| входа| активации)?|пароль|otp)[\s\S]{1,50}?([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b/, // Standalone 6-digit code
    /(?:is|:)\s*([0-9]{4,8})\b/i,
  ];

  /**
   * Safely extracts verification link or OTP code from an email message.
   */
  public static extractVerification(message: EmailMessage, targetOrigin?: string): VerificationData {
    const html = message.html || '';
    const text = message.text || '';
    const subject = message.subject || '';

    const isCodeEmail = /code|код|otp|pin|login|пароль/i.test(`${subject} ${text}`);

    // 1. If email appears to be an OTP code email, try extracting code first
    const codeResult = this.findOtpCode(subject, text, html);
    if (isCodeEmail && codeResult) {
      return codeResult;
    }

    // 2. Try to find link in HTML or Text
    const linkResult = this.findVerificationLink(html, text, targetOrigin);
    if (linkResult && linkResult.confidence >= 0.8) {
      return linkResult;
    }

    if (codeResult) {
      return codeResult;
    }

    if (linkResult) {
      return linkResult;
    }

    return { type: 'none', confidence: 0 };
  }

  /**
   * Extracts verification link from HTML and text without executing JavaScript.
   */
  public static findVerificationLink(
    html: string,
    text: string,
    targetOrigin?: string
  ): VerificationData | null {
    const candidates: Array<{ url: string; confidence: number }> = [];

    // Check HTML if available using DOMParser
    if (html && typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Look at all anchor tags
        const anchors = Array.from(doc.querySelectorAll('a[href]'));
        for (const a of anchors) {
          const href = a.getAttribute('href');
          if (!href) continue;

          const anchorText = (a.textContent || '').trim().toLowerCase();
          const cleanUrl = this.sanitizeUrl(href);
          if (!cleanUrl) continue;

          let score = 0;

          // Keyword check in anchor text
          for (const pattern of this.BUTTON_TEXT_PATTERNS) {
            if (pattern.test(anchorText)) {
              score += 0.6;
              break;
            }
          }

          // Keyword check in URL path/query
          const lowerUrl = cleanUrl.toLowerCase();
          for (const kw of this.LINK_KEYWORDS) {
            if (lowerUrl.includes(kw)) {
              score += 0.3;
              break;
            }
          }

          // Domain similarity check if target origin is provided
          if (targetOrigin) {
            try {
              const urlHost = new URL(cleanUrl).hostname;
              const targetHost = new URL(targetOrigin).hostname;
              if (urlHost.endsWith(targetHost) || targetHost.endsWith(urlHost)) {
                score += 0.2;
              }
            } catch {
              // ignore invalid URLs
            }
          }

          if (score > 0.3) {
            candidates.push({ url: cleanUrl, confidence: Math.min(score, 1) });
          }
        }
      } catch {
        // Fallback to text parsing
      }
    }

    // Also scan plain text for URLs
    const rawUrlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let match;
    while ((match = rawUrlRegex.exec(text)) !== null) {
      const url = this.sanitizeUrl(match[1]);
      if (!url) continue;

      const lowerUrl = url.toLowerCase();
      let score = 0;
      for (const kw of this.LINK_KEYWORDS) {
        if (lowerUrl.includes(kw)) {
          score += 0.5;
          break;
        }
      }

      if (score > 0) {
        candidates.push({ url, confidence: score });
      }
    }

    if (candidates.length > 0) {
      // Sort highest confidence first
      candidates.sort((a, b) => b.confidence - a.confidence);
      return {
        type: 'link',
        link: candidates[0].url,
        confidence: candidates[0].confidence,
      };
    }

    return null;
  }

  /**
   * Finds OTP code from subject, text, or plain content.
   */
  public static findOtpCode(subject: string, text: string, html: string): VerificationData | null {
    const content = `${subject}\n${text}\n${html.replace(/<[^>]+>/g, ' ')}`;

    for (const pattern of this.OTP_PATTERNS) {
      const match = pattern.exec(content);
      if (match && match[1]) {
        const code = match[1].trim();
        // Ignore obvious non-codes (e.g. 2026, standard CSS color, etc)
        if (code.length >= 4 && code.length <= 8) {
          return {
            type: 'code',
            code,
            confidence: 0.9,
          };
        }
      }
    }

    return null;
  }

  /**
   * Sanitizes URLs: rejects javascript:, data:, and file: protocols.
   */
  public static sanitizeUrl(rawUrl: string): string | null {
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
      return null;
    } catch {
      return null;
    }
  }
}
