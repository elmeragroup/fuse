import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach } from "vitest";

export type BrowserRenderResult = {
  host: HTMLDivElement;
  rerender: (node: ReactNode) => void;
  unmount: () => void;
};

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

export function render(node: ReactNode): BrowserRenderResult {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const mount = (next: ReactNode): void => {
    flushSync(() => {
      root.render(next);
    });
  };
  mount(node);
  let didUnmount = false;
  const unmount = (): void => {
    if (didUnmount) {
      return;
    }
    didUnmount = true;
    flushSync(() => {
      root.unmount();
    });
    host.remove();
  };
  cleanups.push(unmount);
  return { host, rerender: mount, unmount };
}

/**
 * Resolves after the next frame, so a just-rendered tree's layout effects and the
 * registrations they make (listeners, observers) have run before a suite acts on it.
 */
export function flushEffects(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}
