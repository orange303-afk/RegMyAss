/**
 * QuickPass - DOM Mutation Observer
 * Efficiently watches for dynamic form insertions and modals in Single Page Applications.
 */

import { FORM_MUTATION_DEBOUNCE_MS } from '../shared/constants';

export class DomObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: any = null;

  public start(onChange: () => void): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      let relevantChange = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (
                el.tagName === 'FORM' ||
                el.tagName === 'INPUT' ||
                el.querySelector('form, input, [role="dialog"]')
              ) {
                relevantChange = true;
                break;
              }
            }
          }
        }
        if (relevantChange) break;
      }

      if (relevantChange) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(onChange, FORM_MUTATION_DEBOUNCE_MS);
      }
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    clearTimeout(this.debounceTimer);
  }
}
