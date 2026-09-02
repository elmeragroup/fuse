import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getIsMobileServerSnapshot,
  getIsMobileSnapshot,
  subscribeIsMobile,
  useIsMobile,
} from "./use-is-mobile";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function Probe() {
  return String(useIsMobile());
}

function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  let matches = initialMatches;
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
  };
  const matchMedia = vi.fn((query: string) => {
    expect(query).toBe(MOBILE_MEDIA_QUERY);
    return mediaQueryList;
  });
  vi.stubGlobal("window", { matchMedia });
  return {
    matchMedia,
    listenerCount() {
      return listeners.size;
    },
    setMatches(next: boolean) {
      matches = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIsMobile", () => {
  it("reports false during SSR", () => {
    expect(getIsMobileServerSnapshot()).toBe(false);
    expect(renderToString(createElement(Probe))).toBe("false");
  });

  it("reads mql.matches and notifies through the matchMedia subscription", () => {
    const media = stubMatchMedia(false);
    expect(getIsMobileSnapshot()).toBe(false);

    const onStoreChange = vi.fn();
    const unsubscribe = subscribeIsMobile(onStoreChange);
    expect(media.listenerCount()).toBe(1);
    expect(media.matchMedia).toHaveBeenCalledWith(MOBILE_MEDIA_QUERY);

    media.setMatches(true);
    expect(getIsMobileSnapshot()).toBe(true);
    expect(onStoreChange).toHaveBeenCalledTimes(1);

    media.setMatches(false);
    expect(getIsMobileSnapshot()).toBe(false);
    expect(onStoreChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(media.listenerCount()).toBe(0);
    media.setMatches(true);
    expect(onStoreChange).toHaveBeenCalledTimes(2);
  });
});
