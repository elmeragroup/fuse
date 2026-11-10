import { StrictMode, useLayoutEffect, useRef } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import { DEFAULT_BOOTSTRAP_MANIFEST } from "../../test/color-scheme-contract";
import {
  distinctSteps,
  hydrateStreamedPage,
  serverBoundaryNodes,
  settleScheduledWork,
} from "../../test/streamed-hydration";
import {
  ColorSchemeOutput,
  ColorSchemeSetter,
  emitStorageChange,
  fkasPrivate,
  mountedColorScheme,
  writeManifest,
} from "../../test/theme-browser-fixtures";
import { roleNamed } from "../../test/themed-browser-render";
import { DEFAULT_COLOR_SCHEME_STORAGE_KEY } from "./color-scheme";
import { ThemeProvider } from "./theme-provider";
import { useColorScheme } from "./use-color-scheme";

function transitionStyles(): HTMLStyleElement[] {
  return [...document.head.querySelectorAll("style")].filter((style) =>
    style.textContent.includes("transition:none")
  );
}

beforeEach(() => {
  writeManifest(DEFAULT_BOOTSTRAP_MANIFEST);
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-identity");
  document.documentElement.removeAttribute("data-theme-brand");
  document.documentElement.removeAttribute("data-theme-segment");
  document.documentElement.style.removeProperty("color-scheme");
  for (const meta of document.querySelectorAll('meta[name="color-scheme"]')) {
    meta.remove();
  }
  writeManifest(undefined);
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ThemeProvider transition suppression", () => {
  it("wraps a setter's write in one nonce'd transition lock and removes it afterwards", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    document.documentElement.setAttribute("data-theme", "light");
    const { host } = render(
      <ThemeProvider theme={fkasPrivate} disableTransitionOnChange nonce="csp">
        <ColorSchemeOutput />
        <ColorSchemeSetter value="dark" />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "neutral-fkas-private:light/light");
    expect(transitionStyles()).toEqual([]);

    roleNamed("button", "set").click();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(transitionStyles().map((style) => style.getAttribute("nonce"))).toEqual(["csp"]);
    await expect.poll(() => transitionStyles()).toEqual([]);
  });
});

describe("ThemeProvider on the real browser platform", () => {
  it("resolves system from the real media query and removes its listener on unmount", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");
    const expected = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const added = vi.spyOn(MediaQueryList.prototype, "addEventListener");
    const removed = vi.spyOn(MediaQueryList.prototype, "removeEventListener");

    const { host, unmount } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, `neutral-fkas-private:system/${expected}`);
    expect(document.documentElement.getAttribute("data-theme")).toBe(expected);
    const changeListeners = added.mock.calls
      .filter(([type]) => type === "change")
      .map(([, listener]) => listener);
    expect(changeListeners).toHaveLength(1);

    unmount();
    expect(removed.mock.calls.filter(([type]) => type === "change").map(([, listener]) => listener)).toEqual(
      changeListeners
    );
  });
});

describe("ThemeProvider around a streamed Suspense boundary", () => {
  it("connects without client-rendering a boundary whose content is still streaming", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");
    const { host, recoverableErrors } = await hydrateStreamedPage(
      (boundary) => (
        <ThemeProvider theme={fkasPrivate}>
          <ColorSchemeOutput />
          {boundary}
        </ThemeProvider>
      ),
      <span>Streamed content</span>
    );
    const server = serverBoundaryNodes(host);
    expect(server.template).not.toBeNull();
    expect(server.fallback).not.toBeNull();

    await mountedColorScheme(host, "neutral-fkas-private:dark/dark");
    await settleScheduledWork();

    // A client render deletes the server's markers, so the streamed segment has nowhere to land.
    expect(server.template?.isConnected).toBe(true);
    expect(server.fallback?.isConnected).toBe(true);
    expect(recoverableErrors).toEqual([]);
  });

  it("hydrates a consumer that streams in after the provider connected with the server's value", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");
    const committed: string[] = [];
    function StreamedScheme() {
      const { colorScheme, resolvedColorScheme } = useColorScheme();
      const output = useRef<HTMLElement>(null);
      useLayoutEffect(() => {
        committed.push(output.current?.textContent ?? "");
      });
      return (
        <strong ref={output}>
          {colorScheme}/{resolvedColorScheme ?? "pending"}
        </strong>
      );
    }
    const page = await hydrateStreamedPage(
      (boundary) => (
        <ThemeProvider theme={fkasPrivate}>
          <ColorSchemeOutput />
          {boundary}
        </ThemeProvider>
      ),
      <StreamedScheme />
    );
    await mountedColorScheme(page.host, "neutral-fkas-private:dark/dark");

    await page.finishStreaming();

    await expect.poll(() => distinctSteps(committed)).toEqual(["system/pending", "dark/dark"]);
    expect(page.host.querySelector("strong")?.textContent).toBe("dark/dark");
    expect(page.recoverableErrors).toEqual([]);
  });
});

describe("useColorScheme under StrictMode", () => {
  it("follows the setter and another document's storage event after the double subscribe", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    const { host } = render(
      <StrictMode>
        <ThemeProvider theme={fkasPrivate}>
          <ColorSchemeOutput />
          <ColorSchemeSetter value="dark" />
        </ThemeProvider>
      </StrictMode>
    );
    await mountedColorScheme(host, "neutral-fkas-private:light/light");

    roleNamed("button", "set").click();
    await mountedColorScheme(host, "neutral-fkas-private:dark/dark");

    emitStorageChange(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");
    const expected = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    await mountedColorScheme(host, `neutral-fkas-private:system/${expected}`);
  });
});
