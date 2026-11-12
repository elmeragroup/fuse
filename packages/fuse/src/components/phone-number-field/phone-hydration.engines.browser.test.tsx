// Hydration of a country the server names differently from the browser, which Chromium and WebKit
// must both recover from without a client re-render.
import { useEffect } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { phoneInput, phoneSubmission } from "../../../test/phone-browser-queries";
import { resetCountryNameCache } from "./country-names";

// One country names it in the addon's text; a picker names it in the trigger's name.
const COUNTRY_NAME_FACES = [
  { face: "the single-country addon", countries: ["SE"] },
  { face: "the picker trigger", countries: ["SE", "NO"] },
] as const;

describe("PhoneNumberField country-name hydration", () => {
  it.each(COUNTRY_NAME_FACES)("hydrates a server-named country in $face", async ({ countries }) => {
    const hydrated = vi.fn<() => void>();
    function HydrationWitness() {
      useEffect(() => hydrated(), []);
      return (
        <form aria-label="SSR phone">
          <PhoneNumberField
            label="Server mobile"
            name="phone"
            countries={countries}
            defaultCountryCode="SE"
          />
        </form>
      );
    }
    const element = withLocale("en-US", <HydrationWitness />);
    // The server's Intl data can name a country differently from the browser's.
    resetCountryNameCache();
    const of = vi.spyOn(Intl.DisplayNames.prototype, "of").mockReturnValue("Server Sweden");
    const host = document.createElement("div");
    try {
      host.innerHTML = renderToString(element);
    } finally {
      of.mockRestore();
      resetCountryNameCache();
    }
    document.body.append(host);
    const recover = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      phoneInput("Server mobile").value = "701234567";
      root = hydrateRoot(host, element, { onRecoverableError: recover });
      await expect.poll(() => hydrated.mock.calls.length).toBe(1);
      await expect.poll(() => phoneSubmission("SSR phone").get("phone")).toBe("+46701234567");
      expect(phoneInput("Server mobile").value).toBe("701234567");
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root?.unmount();
      host.remove();
    }
  });
});
