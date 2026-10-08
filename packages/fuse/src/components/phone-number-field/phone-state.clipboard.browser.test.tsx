import { StrictMode, useEffect, useState } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { phoneForm, phoneInput, phoneSubmission } from "../../../test/phone-browser-queries";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";
import { resetCountryNameCache } from "./country-names";

function paste(text: string) {
  const clipboard = new DataTransfer();
  clipboard.setData("text/plain", text);
  phoneInput().dispatchEvent(
    new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard })
  );
}

describe("PhoneNumberField identity and authoritative value", () => {
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

  it.each([
    { source: "a controlled value", field: { value: "+4741234567" } },
    { source: "a default number", field: { defaultValue: "+4741234567" } },
  ])("server-renders $source and hydrates it without recovery or a proposal", async ({ field }) => {
    const hydrated = vi.fn<() => void>();
    const change = vi.fn<(value: string) => void>();
    function HydrationWitness() {
      useEffect(() => hydrated(), []);
      return (
        <form aria-label="SSR phone">
          <PhoneNumberField label="Server mobile" name="phone" onChange={change} {...field} />
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
      expect(change).not.toHaveBeenCalled();
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it.each([
    { mode: "uncontrolled", controlled: false },
    { mode: "controlled", controlled: true },
  ])("keeps a number typed before hydration, $mode, proposing it once", async ({ controlled }) => {
    const hydrated = vi.fn<() => void>();
    const change = vi.fn<(value: string) => void>();
    function Mobile() {
      const [value, setValue] = useState("");
      return controlled ? (
        <PhoneNumberField
          label="Server mobile"
          name="phone"
          value={value}
          onChange={(next) => {
            change(next);
            setValue(next);
          }}
        />
      ) : (
        <PhoneNumberField label="Server mobile" name="phone" onChange={change} />
      );
    }
    function HydrationWitness() {
      useEffect(() => hydrated(), []);
      return (
        <form aria-label="SSR phone">
          <Mobile />
        </form>
      );
    }
    // StrictMode runs the mount effects twice; the number is still proposed once.
    const element = <StrictMode>{withLocale("en-US", <HydrationWitness />)}</StrictMode>;
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const recover = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      const form = phoneForm("SSR phone");
      // The server markup labels the number input on its own: the country trigger has an id
      // of its own rather than the input's.
      const serverInput = phoneInput("Server mobile");
      expect(serverInput.labels?.length).toBe(1);
      expect(roleNamed("button", "Select country").id).not.toBe(serverInput.id);
      // What typing does before the client scripts attach their listeners.
      serverInput.value = "91234567";
      root = hydrateRoot(host, element, { onRecoverableError: recover });
      await expect.poll(() => hydrated.mock.calls.length).toBeGreaterThan(0);
      await expect.poll(() => new FormData(form).get("phone")).toBe("+4791234567");
      expect(phoneInput("Server mobile").value).toBe("91234567");
      expect(change.mock.calls).toEqual([["+4791234567"]]);

      const input = phoneInput("Server mobile");
      input.focus();
      input.setSelectionRange(8, 8);
      await userEvent.keyboard("8");
      expect(input.value).toBe("912345678");
      expect(new FormData(form).get("phone")).toBe("+47912345678");
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root?.unmount();
      host.remove();
    }
  });
});

describe("PhoneNumberField single-country hydration", () => {
  it("hydrates a country the server names differently, keeping a number typed before it", async () => {
    const hydrated = vi.fn<() => void>();
    function HydrationWitness() {
      useEffect(() => hydrated(), []);
      return (
        <form aria-label="SSR phone">
          <PhoneNumberField label="Server mobile" name="phone" countries={["SE"]} />
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
      // One country renders no trigger, so the label names the number input already.
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
