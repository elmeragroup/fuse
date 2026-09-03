import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/ui/phone-number-field";

import "../../../dist/styles.css";
import {
  assertWithinKeyboardFocusRingAtBothDensities,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { EXCLUDED_PRODUCT_COUNTRY_CODES, FLAG_GAP_COUNTRY_CODES } from "../../../test/phone-picker-contract";
import { renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { flagAssets } from "../../flags";

const SELECT_COUNTRY_COPY = {
  "nb-NO": "Velg land",
  "sv-SE": "Välj land",
  "en-US": "Select country",
  "fi-FI": "Valitse maa",
} as const;

const SEARCH_COUNTRIES_COPY = {
  "nb-NO": "Søk etter land",
  "sv-SE": "Sök efter länder",
  "en-US": "Search countries",
  "fi-FI": "Hae maita",
} as const;

const NO_COUNTRIES_COPY = {
  "nb-NO": "Ingen land funnet.",
  "sv-SE": "Inga länder hittades.",
  "en-US": "No countries found.",
  "fi-FI": "Maita ei löytynyt.",
} as const;

function renderField(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

function listboxNamed(): HTMLElement {
  const element = page.getByRole("listbox").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a listbox");
  }
  return element;
}

function searchNamed(name = "Search countries"): HTMLInputElement {
  const labeled = document.querySelector(`input[aria-label="${name}"]`);
  if (labeled instanceof HTMLInputElement) {
    return labeled;
  }
  const listbox = page.getByRole("listbox").query();
  const popup = listbox instanceof HTMLElement ? listbox.parentElement : null;
  const nested = popup?.querySelector("input");
  if (nested instanceof HTMLInputElement) {
    return nested;
  }
  throw new Error(`expected search ${name}`);
}

function hiddenNamed(name: string): HTMLInputElement {
  const match = [...document.querySelectorAll("input[type=hidden]")].find(
    (input) => input.getAttribute("name") === name
  );
  if (!(match instanceof HTMLInputElement)) {
    throw new Error(`expected hidden input ${name}`);
  }
  return match;
}

function triggerFlagImg(): HTMLImageElement {
  const trigger = buttonNamed("Select country");
  const img = trigger.querySelector("img");
  if (!(img instanceof HTMLImageElement)) {
    throw new Error("expected a flag image on the trigger");
  }
  return img;
}

function flagCodeFromSrc(src: string): string | undefined {
  const file = /(?:^|\/)([A-Z]{2})\.svg(?:$|\?)/.exec(src)?.[1];
  if (file) {
    return file;
  }
  try {
    return /<title>([A-Z]{2})<\/title>/i.exec(decodeURIComponent(src))?.[1];
  } catch {
    return undefined;
  }
}

function optionFlagCodes(): string[] {
  return [...listboxNamed().querySelectorAll("img")].flatMap((img) => {
    const code = flagCodeFromSrc(img.getAttribute("src") ?? "");
    return code ? [code] : [];
  });
}

function inputGroupRoot(): HTMLElement {
  const element = document.querySelector("[data-slot=input-group]");
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected an input-group root");
  }
  return element;
}

async function openPicker(name = "Select country"): Promise<HTMLElement> {
  buttonNamed(name).focus();
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => {
    expect(page.getByRole("listbox").query()).not.toBeNull();
  });
  return listboxNamed();
}

describe("PhoneNumberField", () => {
  it("names the country trigger independently of the Field label", () => {
    renderField(<PhoneNumberField label="Mobile" />);
    expect(buttonNamed("Select country")).toBeTruthy();
    expect(page.getByRole("button", { name: "Mobile", exact: true }).query()).toBeNull();
    expect(textboxNamed("Mobile")).toBeTruthy();
    expect(textboxNamed("Mobile")).toHaveProperty("inputMode", "tel");
  });

  it("selects a country from the keyboard, closes, updates the dial code, and focuses the number input", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    expect(buttonNamed("Select country").textContent).toContain("+47");
    await openPicker();
    const search = searchNamed();
    expect(search.getAttribute("autocomplete")).toBe("one-time-code");
    await userEvent.fill(search, "Sweden");
    await vi.waitFor(() => {
      expect(page.getByRole("option", { name: /Sweden/ }).query()).not.toBeNull();
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(buttonNamed("Select country").textContent).toContain("+46");
    expect(document.activeElement).toBe(textboxNamed("Mobile"));
  });

  it("submits E.164 from the hidden input and keeps the formatted display name", async () => {
    const submitted: Array<{ phone: FormDataEntryValue | null; display: FormDataEntryValue | null }> = [];
    renderField(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          submitted.push({
            phone: data.get("phone"),
            display: data.get("phone-display-value"),
          });
        }}>
        <PhoneNumberField label="Mobile" name="phone" />
        <button type="submit">Save</button>
      </form>
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    expect(textboxNamed("Mobile")).toHaveProperty("name", "phone-display-value");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "41234567");
    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    expect(hiddenNamed("phone").value).toBe("+4741234567");
    expect(submitted).toEqual([{ phone: "+4741234567", display: "41234567" }]);
  });

  it("auto-detects SE from +46 and strips the prefix in national mode", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "+46701234567");
    expect(buttonNamed("Select country").textContent).toContain("+46");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "701234567");
  });

  it("clears digits when preserveOnCountryChange is false and re-emits when true", async () => {
    const onChange = vi.fn();
    const { rerender } = renderField(
      <PhoneNumberField label="Mobile" defaultCountryCode="NO" onChange={onChange} />
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    expect(onChange).toHaveBeenLastCalledWith("+4741234567");
    await openPicker();
    await userEvent.fill(searchNamed(), "Sweden");
    await vi.waitFor(() => {
      expect(page.getByRole("option", { name: /Sweden/ }).query()).not.toBeNull();
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "");

    onChange.mockClear();
    rerender(
      withLocale(
        "en-US",
        <PhoneNumberField
          label="Mobile"
          defaultCountryCode="NO"
          preserveOnCountryChange
          onChange={onChange}
        />
      )
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    await openPicker();
    await userEvent.fill(searchNamed(), "Sweden");
    await vi.waitFor(() => {
      expect(page.getByRole("option", { name: /Sweden/ }).query()).not.toBeNull();
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(onChange.mock.calls.at(-1)?.[0]).not.toBe("");
    expect(textboxNamed("Mobile")).not.toHaveProperty("value", "");
  });

  it("strips non-phone characters through the input pipeline", async () => {
    const onChange = vi.fn();
    renderField(<PhoneNumberField label="Mobile" onChange={onChange} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567abc");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "41234567");
    expect(onChange).toHaveBeenLastCalledWith("+4741234567");
  });

  it("intercepts paste, preventDefaults, and lands cleaned digits", async () => {
    const onChange = vi.fn();
    renderField(<PhoneNumberField label="Mobile" onChange={onChange} />);
    const input = textboxNamed("Mobile");
    input.focus();

    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "412-34-567abc");
    const paste = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboard,
    });
    input.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(textboxNamed("Mobile")).not.toHaveProperty("value", "412-34-567abc");
      expect(textboxNamed("Mobile")).toHaveProperty("value", "41234567");
    });
    expect(onChange).toHaveBeenLastCalledWith("+4741234567");
  });

  it("surfaces isInvalid as an alert, disables trigger and input, and keeps readOnly focusable", async () => {
    renderField(
      <>
        <PhoneNumberField label="Broken" isInvalid errorMessage="Enter a mobile number." />
        <PhoneNumberField label="Disabled" isDisabled />
        <PhoneNumberField label="Locked" isReadOnly value="41234567" />
      </>
    );
    const alert = page.getByRole("alert").element();
    expect(alert.textContent).toBe("Enter a mobile number.");
    expect(inputGroupRoot().getAttribute("aria-invalid")).toBe("true");

    const disabledInput = textboxNamed("Disabled");
    expect(disabledInput).toHaveProperty("disabled", true);
    const disabledTrigger = page.getByRole("button", { name: "Select country" }).elements()[1];
    expect(disabledTrigger).toHaveProperty("disabled", true);

    const locked = textboxNamed("Locked");
    expect(locked).toHaveProperty("readOnly", true);
    locked.focus();
    expect(document.activeElement).toBe(locked);
    await userEvent.keyboard("9");
    expect(locked).toHaveProperty("value", "41234567");
  });

  it("renders dictionary defaults in all four locales and lets override props win", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderField(<PhoneNumberField label="Mobile" />, locale);
      expect(
        page.getByRole("button", { name: SELECT_COUNTRY_COPY[locale], exact: true }).query()
      ).not.toBeNull();
      await userEvent.click(page.getByRole("button", { name: SELECT_COUNTRY_COPY[locale], exact: true }));
      await vi.waitFor(() => {
        expect(page.getByRole("listbox").query()).not.toBeNull();
      });
      expect(searchNamed(SEARCH_COUNTRIES_COPY[locale])).toBeTruthy();
      unmount();
    }

    renderField(
      <PhoneNumberField
        label="Mobile"
        selectCountryLabel="Pick a country"
        searchCountriesLabel="Filter countries"
        noCountriesFoundText="Nothing here."
      />,
      "nb-NO"
    );
    expect(page.getByRole("button", { name: "Pick a country", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Velg land", exact: true }).query()).toBeNull();
    await openPicker("Pick a country");
    expect(searchNamed("Filter countries")).toBeTruthy();
    await userEvent.fill(searchNamed("Filter countries"), "zzzz");
    await vi.waitFor(() => {
      expect(page.getByText("Nothing here.", { exact: true }).query()).not.toBeNull();
    });
  });

  it("shows the empty-search copy for the active locale", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await openPicker();
    await userEvent.fill(searchNamed(), "zzzz");
    await vi.waitFor(() => {
      expect(page.getByText(NO_COUNTRIES_COPY["en-US"], { exact: true }).query()).not.toBeNull();
    });
  });

  it("renders packaged flag images for NO/SE/FI with empty alt and lazy-image attributes", () => {
    renderField(<PhoneNumberField label="Norway" defaultCountryCode="NO" />);
    const img = triggerFlagImg();
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
    expect(img.getAttribute("width")).toBe("20");
    expect(img.getAttribute("height")).toBe("15");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("draggable")).toBe("false");
    expect(img.getAttribute("src")).toBe(flagAssets.NO);
    expect(flagCodeFromSrc(img.getAttribute("src") ?? "")).toBe("NO");
    expect(img.getAttribute("src")).not.toContain("flagcdn.com");
  });

  it("never lists AC, BQ, EH, TA or excluded product countries in the picker", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await openPicker();
    const codes = optionFlagCodes();
    expect(codes.length).toBeGreaterThan(10);
    for (const code of FLAG_GAP_COUNTRY_CODES) {
      expect(codes, code).not.toContain(code);
    }
    for (const code of EXCLUDED_PRODUCT_COUNTRY_CODES) {
      expect(codes, code).not.toContain(code);
    }
    for (const code of codes) {
      expect(Object.hasOwn(flagAssets, code), code).toBe(true);
    }
  });

  it("falls back from an untyped unresolved defaultCountryCode to NO", () => {
    renderField(
      <PhoneNumberField
        label="Mobile"
        // @ts-expect-error AC has no packaged flag; runtime falls back to NO.
        defaultCountryCode="AC"
      />
    );
    expect(buttonNamed("Select country").textContent).toContain("+47");
    expect(triggerFlagImg().getAttribute("src")).toBe(flagAssets.NO);
  });

  it("waits while the resolved picker container element is still null", async () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return <PhoneNumberField label="Pending" container={ref} />;
    }
    renderField(<NeverAttached />);
    await userEvent.click(buttonNamed("Select country"));
    expect(page.getByRole("listbox").query()).toBeNull();
  });

  it("portals the picker into an explicit container element", async () => {
    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? <PhoneNumberField label="Island" container={node} /> : null}
        </>
      );
    }
    renderField(<ExplicitContainer />);
    await openPicker();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(listboxNamed())).toBe(true);
  });

  it("paints the within ring on the group for keyboard focus, at both densities", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await assertWithinKeyboardFocusRingAtBothDensities(
      buttonNamed("Select country"),
      textboxNamed("Mobile"),
      inputGroupRoot()
    );
  });

  it("leaves the group ring unpainted for mouse focus on the country trigger", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <PhoneNumberField label="Mobile" />
      </>
    );
    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(before instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    await userEvent.click(before);
    expect(before.matches(":focus-visible")).toBe(false);
    await userEvent.click(buttonNamed("Select country"));
    expectNoFocusRing(inputGroupRoot(), "mouse focus on the country trigger must not paint the group ring");
  });
});
