/**
 * QuickPass - Mail.gw Email Provider
 * API Docs: https://docs.mail.gw/
 */

import { MailTmProvider } from './mail-tm';

export class MailGwProvider extends MailTmProvider {
  public override readonly id = 'mail-gw';
  public override readonly name = 'Mail.gw';

  constructor() {
    super('https://api.mail.gw');
  }
}
