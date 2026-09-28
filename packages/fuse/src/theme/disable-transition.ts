/**
 * Runtime transition suppression is adapted from next-themes
 * (https://github.com/pacocoursey/next-themes).
 *
 * MIT License
 * Copyright (c) 2022 Paco Coursey
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const TRANSITION_DISABLE_CSS =
  "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}";

/** The window members transition suppression touches. `globalThis` satisfies it structurally. */
export type TransitionHost = {
  /** Receives the style; absent during a server render or in a document-less sandbox. */
  readonly document?: {
    /** Receives the temporary transition-suppression style. */
    readonly head: Pick<HTMLHeadElement, "append">;
    /** Creates the transition-suppression style. */
    createElement(tagName: "style"): HTMLStyleElement;
    /** Creates the style's text. */
    createTextNode(data: string): Text;
    /** Finds the body whose style read flushes the suppression. */
    querySelector(selectors: "body"): Element | null;
  };
  /** Flushes styles so the suppression applies before its removal. */
  getComputedStyle(element: Element): void;
  /** Schedules the suppression's removal. Required, so the style can never stay on. */
  setTimeout(callback: () => void, ms: number): void;
};

/**
 * Suppresses CSS transitions for one synchronous `data-theme` write: it appends a nonce'd
 * style, and the returned restore flushes styles and removes it on the next task.
 *
 * @param host - The browser-shaped host whose document receives the style.
 * @param nonce - The CSP nonce for the style, when the host sets one.
 * @returns The restore to call right after the write; a no-op when the host has no document.
 */
export function disableColorSchemeTransitions(host: TransitionHost, nonce: string | undefined): () => void {
  try {
    const document = host.document;
    if (document === undefined) {
      return () => undefined;
    }
    const css = document.createElement("style");
    if (nonce !== undefined) {
      css.setAttribute("nonce", nonce);
    }
    css.append(document.createTextNode(TRANSITION_DISABLE_CSS));
    document.head.append(css);

    return () => {
      try {
        const body = document.querySelector("body");
        if (body !== null) {
          host.getComputedStyle(body);
        }
      } catch {
        // body may be absent during runtime writes
      }
      host.setTimeout(() => {
        css.remove();
      }, 1);
    };
  } catch {
    return () => undefined;
  }
}
