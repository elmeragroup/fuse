// A controlled country's hydration, in Chromium and WebKit. Unit under test: PhoneNumberField
// with `countryCode`, from server HTML to the hydrated field, with a number typed before the
// client scripts attached. Oracles: the notice contract on `onCountryChange`, which announces a
// disagreement once as it starts, and React's own hydration contract, no recoverable error.
import { act } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { phoneInput } from "../../../test/phone-browser-queries";

declare global {
  /** React's flag for an environment where `act` flushes updates and effects. */
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// `act` flushes hydration and every update and effect it causes before it resolves, in an
// environment that declares itself an act environment.
const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

describe("PhoneNumberField controlled-country hydration", () => {
  it("announces a country detected in a number typed before hydration once", async () => {
    const countryChange = vi.fn<(country: { code: string; dialCode: string }) => void>();
    // The parent keeps its code, whatever the field proposes.
    const element = withLocale(
      "en-US",
      <PhoneNumberField label="Mobile" countryCode="NO" onCountryChange={countryChange} />
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const recover = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      // What typing does before the client scripts attach their listeners.
      phoneInput().value = "+46701234567";
      // A callback that returns a promise takes act's async path, which also waits out the
      // microtasks hydration schedules.
      await act(() => {
        root = hydrateRoot(host, element, { onRecoverableError: recover });
        return Promise.resolve();
      });
      expect(countryChange.mock.calls.map(([country]) => country.code)).toEqual(["SE"]);
      expect(recover).not.toHaveBeenCalled();
    } finally {
      const mounted = root;
      if (mounted) {
        await act(() => {
          mounted.unmount();
          return Promise.resolve();
        });
      }
      host.remove();
    }
  });
});
