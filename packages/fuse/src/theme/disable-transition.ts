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

export function disableColorSchemeTransitions(nonce: string | undefined): () => void {
  try {
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
          window.getComputedStyle(body);
        }
      } catch {
        // body may be absent during runtime writes
      }
      window.setTimeout(() => {
        css.remove();
      }, 1);
    };
  } catch {
    return () => undefined;
  }
}
