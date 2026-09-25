import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import type { PhoneNumberFieldProps } from "@elmeragroup/fuse/phone-number-field";

import "../../../dist/styles.css";
import {
  assertWithinKeyboardFocusRingAtBothDensities,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  countryListbox,
  countrySearch,
  openPicker,
  selectCountry,
} from "../../../test/phone-browser-queries";
import { EXCLUDED_PRODUCT_COUNTRY_CODES, FLAG_GAP_COUNTRY_CODES } from "../../../test/phone-picker-contract";
import { renderThemed, roleNamed, textboxNamed } from "../../../test/themed-browser-render";
import { flagAssets } from "../../flags";
import { resetCountryNameCache } from "./country-names";

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

function hiddenNamed(name: string): HTMLInputElement {
  // DOM audit: the E.164 submit control is type=hidden, so it has no role.
  const match = document.body.querySelector(`input[type="hidden"][name="${name}"]`);
  if (!(match instanceof HTMLInputElement)) {
    throw new Error(`expected hidden input ${name}`);
  }
  return match;
}

function triggerFlagImg(): HTMLImageElement {
  const trigger = roleNamed("button", "Select country");
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
  return [...countryListbox().querySelectorAll("img")].flatMap((img) => {
    const code = flagCodeFromSrc(img.getAttribute("src") ?? "");
    return code ? [code] : [];
  });
}

function inputGroupRoot(name: string): HTMLElement {
  const group = textboxNamed(name).closest('[role="group"]');
  if (!(group instanceof HTMLElement)) {
    throw new Error(`expected an input-group root around ${name}`);
  }
  return group;
}

describe("PhoneNumberField", () => {
  it("names the country trigger independently of the Field label", () => {
    renderField(<PhoneNumberField label="Mobile" />);
    expect(roleNamed("button", "Select country")).toBeTruthy();
    expect(page.getByRole("button", { name: "Mobile", exact: true }).query()).toBeNull();
    expect(textboxNamed("Mobile")).toBeTruthy();
    expect(textboxNamed("Mobile")).toHaveProperty("inputMode", "tel");
  });

  it("names the country search independently of the Field label and opts it out of autofill", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await openPicker();
    const search = countrySearch();
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(search.getAttribute("aria-labelledby")).toBeFalsy();
    expect(search.getAttribute("autocomplete")).toBe("one-time-code");
    expect(page.getByRole("combobox", { name: "Search countries", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("combobox", { name: "Mobile", exact: true }).query()).toBeNull();
  });

  it("insets the country search from the popup edge", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await openPicker();
    const search = countrySearch();
    // DOM audit: popup chrome has no role; inset is the search group's box against the content slot.
    const group = search.closest("[data-slot=input-group]");
    const popup = group?.closest("[data-slot=combobox-content]");
    if (!(group instanceof HTMLElement) || !(popup instanceof HTMLElement)) {
      throw new Error("expected search group inside the country popup");
    }
    const groupBox = group.getBoundingClientRect();
    const popupBox = popup.getBoundingClientRect();
    const styles = getComputedStyle(group);
    const observed = {
      slot: group.getAttribute("data-slot"),
      margin: [styles.marginTop, styles.marginRight, styles.marginBottom, styles.marginLeft],
      inset: {
        top: groupBox.top - popupBox.top,
        left: groupBox.left - popupBox.left,
        right: popupBox.right - groupBox.right,
      },
    };
    expect(observed.inset.top, JSON.stringify(observed)).toBeGreaterThan(0);
    expect(observed.inset.left, JSON.stringify(observed)).toBeGreaterThan(0);
    expect(observed.inset.right, JSON.stringify(observed)).toBeGreaterThan(0);
  });

  it("does not call Intl.DisplayNames.of until the country popup opens", async () => {
    resetCountryNameCache();
    const ofSpy = vi.spyOn(Intl.DisplayNames.prototype, "of");
    try {
      renderField(<PhoneNumberField label="Mobile" />);
      expect(ofSpy).not.toHaveBeenCalled();
      await openPicker();
      expect(ofSpy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      ofSpy.mockRestore();
      resetCountryNameCache();
    }
  });

  it("keeps filtered country options through the close transition", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await openPicker();
    await userEvent.fill(countrySearch(), "swe");
    await vi.waitFor(() => {
      expect(page.getByRole("option", { name: /Sweden/ }).query()).not.toBeNull();
    });
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("option", { name: /Sweden/ }).query()).not.toBeNull();
      expect(page.getByText("No countries found.").query()).toBeNull();
    });
  });

  it("selects a country from the keyboard, closes, updates the dial code, and focuses the number input", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
    await selectCountry("Sweden");
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    // Focus moves to the number input as the picker closes, which can land a frame later.
    await expect.element(page.getByRole("textbox", { name: "Mobile", exact: true })).toHaveFocus();
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
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "701234567");
  });

  it("clears digits when preserveOnCountryChange is false and re-emits when true", async () => {
    const onChange = vi.fn();
    const { rerender } = renderField(
      <PhoneNumberField label="Mobile" defaultCountryCode="NO" onChange={onChange} />
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    expect(onChange).toHaveBeenLastCalledWith("+4741234567");
    await selectCountry("Sweden");
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
    await selectCountry("Sweden");
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
    expect(inputGroupRoot("Broken").getAttribute("aria-invalid")).toBe("true");

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
      expect(countrySearch(SEARCH_COUNTRIES_COPY[locale])).toBeTruthy();
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
    expect(countrySearch("Filter countries")).toBeTruthy();
    await userEvent.fill(countrySearch("Filter countries"), "zzzz");
    await vi.waitFor(() => {
      expect(page.getByText("Nothing here.", { exact: true }).query()).not.toBeNull();
    });
  });

  it("shows the empty-search copy for the active locale", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await openPicker();
    await userEvent.fill(countrySearch(), "zzzz");
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
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
    expect(triggerFlagImg().getAttribute("src")).toBe(flagAssets.NO);
  });

  it("waits while the resolved picker container element is still null", async () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return <PhoneNumberField label="Pending" container={ref} />;
    }
    renderField(<NeverAttached />);
    await userEvent.click(roleNamed("button", "Select country"));
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
    expect(island.contains(countryListbox())).toBe(true);
  });

  it("keeps the list clamped inside the popup instead of growing it to the full country list", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    const list = await openPicker();
    // Before the picker composed `Combobox.List`, its own clamp was written
    // `max-h-[min(300px,calc(var(--available-height)-2.75rem))]`, and CSS `calc` requires
    // whitespace around `-`: the whole `min()` was invalid, the declaration was dropped, the
    // list never scrolled, and the popup grew to the height of every country row
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    expect(list.clientHeight).toBeLessThan(window.innerHeight);
  });

  it("paints the within ring on the group for keyboard focus, at both densities", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    await assertWithinKeyboardFocusRingAtBothDensities(
      roleNamed("button", "Select country"),
      textboxNamed("Mobile"),
      inputGroupRoot("Mobile")
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
    await userEvent.click(roleNamed("button", "Select country"));
    expectNoFocusRing(
      inputGroupRoot("Mobile"),
      "mouse focus on the country trigger must not paint the group ring"
    );
  });
});

/**
 * The controlled configurations, which had no coverage before this ticket: the emitted
 * value is fed straight back in as `value`, which is what makes the sync effect run on the
 * hook's own output.
 */
function ControlledField(props: Omit<PhoneNumberFieldProps, "value" | "onChange">): ReactElement {
  const [value, setValue] = useState("");
  return <PhoneNumberField {...props} value={value} onChange={setValue} />;
}

describe("PhoneNumberField controlled value", () => {
  it("emits the national format without rewriting what was typed", async () => {
    renderField(<ControlledField label="Mobile" name="phone" outputFormat="national" />);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    await expect.poll(() => hiddenNamed("phone").value).toBe("41 23 45 67");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "41234567");
  });

  it("shows what was entered in international mode and stores the full number", async () => {
    renderField(<ControlledField label="Mobile" name="phone" international />);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    await expect.poll(() => hiddenNamed("phone").value).toBe("+4741234567");
    // The display follows the entry in controlled and uncontrolled use alike. Before
    // this ticket a controlled field rewrote itself to "+4741234567" once the number became
    // valid, and an uncontrolled one never did.
    expect(textboxNamed("Mobile")).toHaveProperty("value", "41234567");
  });

  it("keeps a typed international prefix in international mode", async () => {
    renderField(<ControlledField label="Mobile" name="phone" international />);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "+4741234567");
    await expect.poll(() => hiddenNamed("phone").value).toBe("+4741234567");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "+4741234567");
  });

  it("formats as you type when formatOnType is set", async () => {
    renderField(<ControlledField label="Mobile" name="phone" formatOnType />);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    await expect.poll(() => hiddenNamed("phone").value).toBe("+4741234567");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "41 23 45 67");
  });
});
