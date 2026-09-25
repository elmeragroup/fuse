import { useEffect, useState } from "react";

import type { MetadataJson } from "libphonenumber-js/core";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { phoneForm, phoneInput, phoneSubmission } from "../../../test/phone-browser-queries";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";
import { defaultMetadata } from "./phone-engine";

const swedishMetadata: MetadataJson = {
  ...defaultMetadata,
  countries: { SE: defaultMetadata.countries.SE },
  country_calling_codes: { "46": ["SE"] },
};

function paste(text: string) {
  const clipboard = new DataTransfer();
  clipboard.setData("text/plain", text);
  phoneInput().dispatchEvent(
    new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard })
  );
}

describe("PhoneNumberField identity and authoritative value", () => {
  it.each(["+24712345", "+79123456789", "+46701234567"])(
    "preserves initial and pasted identity for %s",
    async (value) => {
      const change = vi.fn<(value: string) => void>();
      const field = (controlled: boolean) =>
        withLocale(
          "en-US",
          <form aria-label="Phone form">
            <PhoneNumberField
              label="Mobile"
              name="phone"
              value={controlled ? value : undefined}
              onChange={change}
            />
          </form>
        );
      const { rerender } = render(field(true));
      expect(phoneSubmission().get("phone")).toBe(value);
      expect(phoneInput().value).toBe(value === "+46701234567" ? "701234567" : value);
      rerender(field(false));
      paste(value);
      await expect.poll(() => change.mock.calls.at(-1)?.[0]).toBe(value);
      expect(phoneSubmission().get("phone")).toBe(value);
      expect(roleNamed("button", "Select country").textContent).toContain(
        value === "+46701234567" ? "+46" : "+47"
      );
    }
  );

  it("keeps rejected proposals out of the display and actual phoneSubmission, then accepts a delayed echo", async () => {
    const proposals: string[] = [];
    function Parent() {
      const [value, setValue] = useState("+4741234567");
      return (
        <form aria-label="Phone form">
          <PhoneNumberField
            label="Mobile"
            name="phone"
            value={value}
            international
            onChange={(next) => proposals.push(next)}
          />
          <button type="button" onClick={() => setValue(proposals.at(-1) ?? "")}>
            Accept
          </button>
          <button type="button" onClick={() => setValue("+46701234567")}>
            Replace
          </button>
          <button type="button" onClick={() => setValue("")}>
            Clear
          </button>
        </form>
      );
    }
    render(withLocale("en-US", <Parent />));
    await userEvent.fill(phoneInput(), "99887766");
    expect(proposals).toEqual(["+4799887766"]);
    expect(phoneInput().value).toBe("+4741234567");
    expect(phoneSubmission().get("phone")).toBe("+4741234567");
    await userEvent.click(roleNamed("button", "Accept"));
    expect(phoneInput().value).toBe("99887766");
    expect(phoneSubmission().get("phone")).toBe("+4799887766");
    await userEvent.click(roleNamed("button", "Replace"));
    expect(phoneInput().value).toBe("+46701234567");
    expect(phoneSubmission().get("phone")).toBe("+46701234567");
    await userEvent.click(roleNamed("button", "Clear"));
    expect(phoneInput().value).toBe("");
    expect(phoneSubmission().get("phone")).toBe("");
  });

  it("keeps a controlled value parent-owned through a native reset until the parent accepts empty", async () => {
    const change = vi.fn<(value: string) => void>();
    function Parent() {
      const [value, setValue] = useState("");
      return (
        <form aria-label="Phone form">
          <PhoneNumberField
            label="Mobile"
            name="phone"
            value={value}
            onChange={(next) => {
              change(next);
              setValue(next);
            }}
          />
          <button type="reset">Reset</button>
          <button type="button" onClick={() => setValue("")}>
            Clear
          </button>
        </form>
      );
    }
    render(withLocale("en-US", <Parent />));
    await userEvent.fill(phoneInput(), "41234567");
    expect(phoneSubmission().get("phone")).toBe("+4741234567");
    const changeCalls = change.mock.calls.length;

    phoneForm().reset();

    await expect.poll(() => phoneSubmission().get("phone")).toBe("+4741234567");
    expect(change).toHaveBeenCalledTimes(changeCalls);
    await userEvent.click(roleNamed("button", "Clear"));
    await expect.poll(() => phoneInput().value).toBe("");
    expect(phoneSubmission().get("phone")).toBe("");
  });

  it("submits immediately accepted drafts and keeps accepted country identity on rejected paste", async () => {
    const proposals: string[] = [];
    function Parent() {
      const [value, setValue] = useState("");
      return (
        <form aria-label="Phone form">
          <PhoneNumberField
            label="Mobile"
            name="phone"
            international
            value={value}
            onChange={(next) => {
              proposals.push(next);
              if (next.startsWith("+47")) setValue(next);
            }}
          />
        </form>
      );
    }
    render(withLocale("en-US", <Parent />));
    await userEvent.fill(phoneInput(), "41234567");
    expect(phoneInput().value).toBe("41234567");
    expect(phoneSubmission().get("phone")).toBe("+4741234567");
    paste("+46701234567");
    await expect.poll(() => proposals.at(-1)).toBe("+46701234567");
    expect(phoneInput().value).toBe("41234567");
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
    expect(phoneSubmission().get("phone")).toBe("+4741234567");
  });

  it("preserves a controlled number when its country leaves the metadata", async () => {
    function Parent({ metadata }: { metadata: MetadataJson }) {
      const [value, setValue] = useState("+4741234567");
      return (
        <form aria-label="Phone form">
          <PhoneNumberField
            label="Mobile"
            name="phone"
            metadata={metadata}
            value={value}
            onChange={setValue}
          />
        </form>
      );
    }
    const { rerender } = render(withLocale("en-US", <Parent metadata={defaultMetadata} />));
    rerender(withLocale("en-US", <Parent metadata={swedishMetadata} />));
    expect(phoneInput().value).toBe("+4741234567");
    expect(phoneSubmission().get("phone")).toBe("+4741234567");
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    await userEvent.fill(phoneInput(), "701234567");
    expect(phoneInput().value).toBe("701234567");
    expect(phoneSubmission().get("phone")).toBe("+46701234567");
  });

  it.each([false, true])("reconciles metadata with existing digits: %s", async (existing) => {
    const change = vi.fn<(value: string) => void>();
    const field = (metadata: MetadataJson) =>
      withLocale(
        "en-US",
        <form aria-label="Phone form">
          <PhoneNumberField label="Mobile" name="phone" metadata={metadata} onChange={change} />
        </form>
      );
    const { rerender } = render(field(defaultMetadata));
    if (existing) await userEvent.fill(phoneInput(), "41234567");
    rerender(field(swedishMetadata));
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    // Metadata replacement keeps existing international identity, even if the catalog cannot parse it.
    expect(phoneInput().value).toBe(existing ? "+4741234567" : "");
    expect(phoneSubmission().get("phone")).toBe(existing ? "+4741234567" : "");
    await userEvent.fill(phoneInput(), "701234567");
    expect(change).toHaveBeenLastCalledWith("+46701234567");
    expect(phoneSubmission().get("phone")).toBe("+46701234567");
  });

  it("keeps an uncontrolled international draft when only the output format changes", async () => {
    const field = (outputFormat: "e164" | "raw") =>
      withLocale(
        "en-US",
        <form aria-label="Phone form">
          <PhoneNumberField label="Mobile" name="phone" international outputFormat={outputFormat} />
        </form>
      );
    const { rerender } = render(field("e164"));
    await userEvent.fill(phoneInput(), "41234567");
    expect(phoneSubmission().get("phone")).toBe("+4741234567");
    rerender(field("raw"));
    expect(phoneInput().value).toBe("41234567");
    expect(phoneSubmission().get("phone")).toBe("41234567");
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
  });

  it("server-renders populated form state and hydrates it without recovery", async () => {
    const hydrated = vi.fn<() => void>();
    function HydrationWitness() {
      useEffect(() => hydrated(), []);
      return (
        <form aria-label="SSR phone">
          <PhoneNumberField label="Server mobile" name="phone" value="+4741234567" />
        </form>
      );
    }
    const element = withLocale("en-US", <HydrationWitness />);
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const form = host.querySelector("form");
    if (!form) throw new Error("Expected server form");
    expect(new FormData(form).get("phone")).toBe("+4741234567");
    expect(new FormData(form).get("phone-display-value")).toBe("41234567");
    const recover = vi.fn();
    const root = hydrateRoot(host, element, { onRecoverableError: recover });
    try {
      await expect.poll(() => hydrated.mock.calls.length).toBe(1);
      await expect.poll(() => phoneInput("Server mobile").value).toBe("41234567");
      expect(new FormData(form).get("phone")).toBe("+4741234567");
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });
});

describe("PhoneNumberField native editing boundaries", () => {
  it("ignores trusted read-only paste and restores editing after toggles", async () => {
    const change = vi.fn<(value: string) => void>();
    const countryChange = vi.fn();
    const field = (isReadOnly: boolean, isDisabled = false) =>
      withLocale(
        "en-US",
        <form aria-label="Phone form">
          <input aria-label="Clipboard source" defaultValue="+46701234567" />
          <input aria-label="Paste witness" />
          <PhoneNumberField
            label="Mobile"
            name="phone"
            isReadOnly={isReadOnly}
            isDisabled={isDisabled}
            onChange={change}
            onCountryChange={countryChange}
          />
        </form>
      );
    const { rerender } = render(field(false));
    await userEvent.fill(phoneInput(), "41234567");
    change.mockClear();
    countryChange.mockClear();
    rerender(field(true));
    const source = phoneInput("Clipboard source");
    source.focus();
    source.select();
    await userEvent.copy();
    phoneInput("Paste witness").focus();
    await userEvent.paste();
    expect(phoneInput("Paste witness").value).toBe("+46701234567");
    const trusted: boolean[] = [];
    phoneInput().addEventListener("paste", (event) => trusted.push(event.isTrusted));
    phoneInput().focus();
    await userEvent.paste();
    expect(trusted).toEqual([true]);
    expect(document.activeElement).toBe(phoneInput());
    expect(phoneInput().value).toBe("41234567");
    expect(phoneSubmission().get("phone")).toBe("+4741234567");
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
    expect(change).not.toHaveBeenCalled();
    expect(countryChange).not.toHaveBeenCalled();
    rerender(field(false, true));
    paste("+46701234567");
    expect(phoneSubmission().has("phone")).toBe(false);
    expect(phoneSubmission().has("phone-display-value")).toBe(false);
    expect(phoneInput().value).toBe("41234567");
    expect(change).not.toHaveBeenCalled();
    rerender(field(false));
    phoneInput().focus();
    await userEvent.paste();
    expect(phoneInput().value).toBe("701234567");
    expect(phoneSubmission().get("phone")).toBe("+46701234567");
    expect(change).toHaveBeenCalledExactlyOnceWith("+46701234567");
    expect(countryChange).toHaveBeenCalledTimes(1);
  });
});
