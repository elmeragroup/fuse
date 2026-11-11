// SearchField hydration, in Chromium and WebKit. Unit under test: SearchField from server HTML to
// the hydrated tree. Oracles: the text a user typed into the server-rendered input before the client
// scripts ran, which hydration must keep and propose through `onChange`, and React's hydration
// contract, no recoverable error.
import { StrictMode, useEffect, useState } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { SearchField } from "./search-field";

function searchbox(): HTMLInputElement {
  const input = page.getByRole("searchbox", { name: "Meter search", exact: true }).element();
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("expected the searchbox");
  }
  return input;
}

describe("SearchField hydration", () => {
  it.each([
    { mode: "uncontrolled", controlled: false },
    { mode: "controlled", controlled: true },
  ])("keeps text typed before hydration, $mode, and proposes it once", async ({ controlled }) => {
    const hydrated = vi.fn<() => void>();
    const change = vi.fn<(value: string) => void>();
    function Search() {
      const [value, setValue] = useState("");
      return controlled ? (
        <SearchField
          label="Meter search"
          name="q"
          value={value}
          onChange={(next) => {
            change(next);
            setValue(next);
          }}
        />
      ) : (
        <SearchField label="Meter search" name="q" onChange={change} />
      );
    }
    function HydrationWitness() {
      useEffect(() => hydrated(), []);
      return (
        <form aria-label="Meters">
          <Search />
        </form>
      );
    }
    // StrictMode runs the mount effects twice; the text is still proposed once.
    const element = <StrictMode>{withLocale("en-US", <HydrationWitness />)}</StrictMode>;
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const recover = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      // What typing does before the client scripts attach their listeners.
      searchbox().value = "735";
      root = hydrateRoot(host, element, { onRecoverableError: recover });
      await expect.poll(() => hydrated.mock.calls.length).toBeGreaterThan(0);
      expect(searchbox().value).toBe("735");
      expect(change.mock.calls).toEqual([["735"]]);
      const form = host.querySelector("form");
      expect(form === null ? null : new FormData(form).get("q")).toBe("735");
      // The clear button shows once the field holds the text.
      await expect.element(page.getByRole("button", { name: "Clear search", exact: true })).toBeVisible();
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root?.unmount();
      host.remove();
    }
  });
});
