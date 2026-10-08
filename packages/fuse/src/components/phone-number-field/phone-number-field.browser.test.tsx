import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { MetadataJson } from "libphonenumber-js/core";
import { createPortal, flushSync } from "react-dom";
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
  phoneInput,
  phoneSubmission,
  selectCountry,
} from "../../../test/phone-browser-queries";
import { EXCLUDED_PRODUCT_COUNTRY_CODES, FLAG_GAP_COUNTRY_CODES } from "../../../test/phone-picker-contract";
import {
  CONTROL_MD,
  fieldRootFrom,
  formNamed,
  normalLineHeightOf,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { flagAssets } from "../../flags";
import { resetCountryNameCache } from "./country-names";
import { defaultMetadata } from "./phone-engine";

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

function triggerDialCode(dialCode: string): HTMLElement {
  const trigger = roleNamed("button", "Select country");
  const match = [...trigger.querySelectorAll("span")].find((span) => span.textContent === dialCode);
  if (!(match instanceof HTMLElement)) {
    throw new Error(`expected dial code ${dialCode} on the trigger`);
  }
  return match;
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

  it("fits the country trigger inside the md field box at the 24px target floor, at both densities", () => {
    renderField(<PhoneNumberField label="Mobile" />);
    const trigger = roleNamed("button", "Select country");
    // The InputGroup rail drops its block padding only for a direct <button> child.
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.parentElement?.getAttribute("data-slot")).toBe("input-group-addon");
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const group = inputGroupRoot("Mobile");
      const groupBox = group.getBoundingClientRect();
      expect(px(getComputedStyle(group).height), density).toBe(CONTROL_MD[density].height);
      expect(trigger.getBoundingClientRect().height, density).toBeGreaterThanOrEqual(24);
      const railBox = trigger.parentElement?.getBoundingClientRect();
      expect(railBox?.height, `${density} rail`).toBeLessThanOrEqual(group.clientHeight);
      expect(railBox?.top, `${density} rail top`).toBeGreaterThanOrEqual(groupBox.top);
      expect(railBox?.bottom, `${density} rail bottom`).toBeLessThanOrEqual(groupBox.bottom);
    }
  });

  it("keeps the Field label and description when a wrapper forwards id and ARIA props as undefined", async () => {
    renderField(
      <PhoneNumberField
        label="Mobile"
        description="Used for delivery updates."
        id={undefined}
        aria-label={undefined}
        aria-labelledby={undefined}
        aria-describedby={undefined}
      />
    );
    await expect.element(textboxNamed("Mobile")).toHaveAccessibleDescription("Used for delivery updates.");
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

  it("blocks an empty required submit and allows it once filled", async () => {
    renderField(
      <form aria-label="Phone form">
        <PhoneNumberField label="Mobile" name="phone" isRequired />
      </form>
    );
    expect(fieldRootFrom("Mobile").hasAttribute("data-invalid")).toBe(false);
    expect(textboxNamed("Mobile")).toHaveProperty("required", true);
    expect(formNamed("Phone form").checkValidity()).toBe(false);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    expect(formNamed("Phone form").checkValidity()).toBe(true);
  });

  it("forwards aria-required to the number input alone without adding a native constraint", async () => {
    renderField(
      <form aria-label="Phone form">
        <PhoneNumberField label="Mobile" name="phone" aria-required />
      </form>
    );
    const input = textboxNamed("Mobile");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input).toHaveProperty("required", false);
    expect(input).toHaveProperty("validity.valueMissing", false);
    expect(formNamed("Phone form").checkValidity()).toBe(true);
    expect(roleNamed("button", "Select country").hasAttribute("aria-required")).toBe(false);
    // DOM audit: the submit and country inputs are type=hidden or visually hidden, so they have no role.
    const otherInputs = [...document.body.querySelectorAll("input")].filter((element) => element !== input);
    expect(otherInputs.length).toBeGreaterThan(0);
    expect(otherInputs.filter((element) => element.hasAttribute("aria-required"))).toEqual([]);
    await openPicker();
    expect(countrySearch().hasAttribute("aria-required")).toBe(false);
  });

  it("submits no display-value key when name is unset", async () => {
    renderField(
      <form aria-label="Phone form">
        <PhoneNumberField label="Mobile" />
      </form>
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    expect([...new FormData(formNamed("Phone form")).keys()]).toEqual([]);
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
      await userEvent.fill(countrySearch(SEARCH_COUNTRIES_COPY[locale]), "zzzz");
      await vi.waitFor(() => {
        expect(page.getByText(NO_COUNTRIES_COPY[locale], { exact: true }).query(), locale).not.toBeNull();
      });
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

  it("paints the within ring on the group for keyboard focus at both densities, and not for mouse focus on the trigger", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <PhoneNumberField label="Mobile" />
      </>
    );
    await assertWithinKeyboardFocusRingAtBothDensities(
      roleNamed("button", "Select country"),
      textboxNamed("Mobile"),
      inputGroupRoot("Mobile")
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
  it("sets the dial code in the number input's font size at the font's normal line height, at both densities", () => {
    renderField(<PhoneNumberField label="Mobile" />);
    // The group centres the trigger and the input, and the input centres its text on the
    // font's normal metrics, so the dial code shares the size and a normal line box.
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const dialCode = triggerDialCode("+47");
      expect(px(getComputedStyle(dialCode).fontSize), `${density} dial code font`).toBe(
        CONTROL_MD[density].font
      );
      // Oracle: a plain block in the same font at `line-height: normal`.
      expect(dialCode.getBoundingClientRect().height, `${density} dial code leading`).toBe(
        normalLineHeightOf(dialCode)
      );
    }
  });
});

describe("PhoneNumberField country order", () => {
  // ISO order, which is the name order in neither locale below.
  const threeCountries: MetadataJson = {
    ...defaultMetadata,
    countries: {
      AT: defaultMetadata.countries.AT,
      AX: defaultMetadata.countries.AX,
      ZA: defaultMetadata.countries.ZA,
    },
    country_calling_codes: { "27": ["ZA"], "358": ["AX"], "43": ["AT"] },
  };

  /** The row the search input's aria-activedescendant points at, by its flag. */
  function highlightedFlagCode(locale: "sv-SE" | "nb-NO"): string | undefined {
    const id = countrySearch(SEARCH_COUNTRIES_COPY[locale]).getAttribute("aria-activedescendant");
    // DOM audit: the option's flag image is decorative, so it has no role of its own.
    const flag = id ? document.getElementById(id)?.querySelector("img") : null;
    return flagCodeFromSrc(flag?.getAttribute("src") ?? "");
  }

  async function closePicker() {
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
  }

  it("lists rows by localized name from the first open, keeping the selection and highlight, and re-sorts for a new locale or catalog at the next open", async () => {
    const change = vi.fn();
    const countryChange = vi.fn();
    const field = (metadata: MetadataJson) => (
      <PhoneNumberField
        label="Mobile"
        metadata={metadata}
        defaultCountryCode="AT"
        onChange={change}
        onCountryChange={countryChange}
      />
    );
    const { rerender } = renderField(field(threeCountries), "sv-SE");
    await openPicker(SELECT_COUNTRY_COPY["sv-SE"]);
    // Sydafrika, Åland, Österrike
    expect(optionFlagCodes()).toEqual(["ZA", "AX", "AT"]);
    expect(page.getByRole("option", { selected: true }).element().textContent).toContain("Österrike");
    await expect.poll(() => highlightedFlagCode("sv-SE")).toBe("AT");

    // A locale change keeps the open picker's order, so the highlight stays on Austria.
    rerender(withLocale("nb-NO", field(threeCountries)));
    expect(optionFlagCodes()).toEqual(["ZA", "AX", "AT"]);
    await expect.poll(() => highlightedFlagCode("nb-NO")).toBe("AT");
    await closePicker();
    await openPicker(SELECT_COUNTRY_COPY["nb-NO"]);
    // Sør-Afrika, Østerrike, Åland
    expect(optionFlagCodes()).toEqual(["ZA", "AT", "AX"]);
    await expect.poll(() => highlightedFlagCode("nb-NO")).toBe("AT");
    await closePicker();

    const withGermany: MetadataJson = {
      ...threeCountries,
      countries: { ...threeCountries.countries, DE: defaultMetadata.countries.DE },
      country_calling_codes: { ...threeCountries.country_calling_codes, "49": ["DE"] },
    };
    rerender(withLocale("nb-NO", field(withGermany)));
    await openPicker(SELECT_COUNTRY_COPY["nb-NO"]);
    // Sør-Afrika, Tyskland, Østerrike, Åland
    expect(optionFlagCodes()).toEqual(["ZA", "DE", "AT", "AX"]);
    await expect.poll(() => highlightedFlagCode("nb-NO")).toBe("AT");
    expect(roleNamed("button", SELECT_COUNTRY_COPY["nb-NO"]).textContent).toContain("+43");
    expect(change).not.toHaveBeenCalled();
    expect(countryChange).not.toHaveBeenCalled();
  });

  it("selects the sorted row the keyboard lands on", async () => {
    const countryChange = vi.fn();
    renderField(
      <PhoneNumberField
        label="Mobile"
        metadata={threeCountries}
        defaultCountryCode="AT"
        onCountryChange={countryChange}
      />,
      "sv-SE"
    );
    await openPicker(SELECT_COUNTRY_COPY["sv-SE"]);
    // From Österrike, the last row, ArrowUp lands on Åland.
    await userEvent.keyboard("{ArrowUp}{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(countryChange).toHaveBeenCalledExactlyOnceWith({ code: "AX", dialCode: "+358" });
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
  // In international mode the display follows the entry in controlled and uncontrolled use
  // alike. Before this ticket a controlled field rewrote itself to "+4741234567" once the
  // number became valid, and an uncontrolled one never did.
  it.each([
    [
      "emits the national format without rewriting what was typed",
      { outputFormat: "national" as const },
      "41234567",
      "41 23 45 67",
      "41234567",
    ],
    [
      "shows what was entered in international mode and stores the full number",
      { international: true },
      "41234567",
      "+4741234567",
      "41234567",
    ],
    [
      "keeps a typed international prefix in international mode",
      { international: true },
      "+4741234567",
      "+4741234567",
      "+4741234567",
    ],
    [
      "formats as you type when formatOnType is set",
      { formatOnType: true },
      "41234567",
      "+4741234567",
      "41 23 45 67",
    ],
  ])("%s", async (_name, fieldProps, typed, stored, display) => {
    renderField(<ControlledField label="Mobile" name="phone" {...fieldProps} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), typed);
    await expect.poll(() => hiddenNamed("phone").value).toBe(stored);
    expect(textboxNamed("Mobile")).toHaveProperty("value", display);
  });
});

describe("PhoneNumberField national trunk prefix", () => {
  // The issue's per-key expectations for a Swedish mobile number typed with its trunk 0.
  const keys = "0701234567";
  const asTyped = [
    "0",
    "07",
    "070",
    "0701",
    "07012",
    "070123",
    "0701234",
    "07012345",
    "070123456",
    "0701234567",
  ];
  const formattedAsTyped = [
    "0",
    "07",
    "070",
    "070-1",
    "070-12",
    "070-123",
    "070-123 4",
    "070-123 45",
    "070-123 45 6",
    "070-123 45 67",
  ];

  it.each([
    { mode: "uncontrolled", controlled: false, formatOnType: false, expected: asTyped },
    { mode: "uncontrolled", controlled: false, formatOnType: true, expected: formattedAsTyped },
    { mode: "controlled", controlled: true, formatOnType: false, expected: asTyped },
    { mode: "controlled", controlled: true, formatOnType: true, expected: formattedAsTyped },
  ])(
    "keeps the trunk 0 on display key by key, $mode, formatOnType $formatOnType",
    async ({ controlled, formatOnType, expected }) => {
      const Field = controlled ? ControlledField : PhoneNumberField;
      renderField(
        <form aria-label="Phone form">
          <Field label="Mobile" name="phone" defaultCountryCode="SE" formatOnType={formatOnType} />
        </form>
      );
      const input = phoneInput();
      input.focus();
      const shown: string[] = [];
      for (const key of keys) {
        await userEvent.keyboard(key);
        shown.push(input.value);
      }
      expect(shown).toEqual(expected);
      expect(new FormData(formNamed("Phone form")).get("phone")).toBe("+46701234567");
    }
  );

  it("strips separators from a filled national number but keeps its trunk 0", async () => {
    renderField(<PhoneNumberField label="Mobile" name="phone" defaultCountryCode="SE" />);
    await userEvent.fill(textboxNamed("Mobile"), "070 123 45 67");
    expect(textboxNamed("Mobile")).toHaveProperty("value", "0701234567");
    expect(hiddenNamed("phone").value).toBe("+46701234567");
  });
});

describe("PhoneNumberField detected numbers", () => {
  function paste(text: string) {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", text);
    phoneInput().dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard })
    );
  }

  it.each([
    { formatOnType: false, completed: "2642351234" },
    { formatOnType: true, completed: "(264) 235-1234" },
  ])(
    "completes a pasted partial international number without repeating its area code, formatOnType $formatOnType",
    async ({ formatOnType, completed }) => {
      renderField(<PhoneNumberField label="Mobile" name="phone" formatOnType={formatOnType} />);
      paste("+12642351");
      await expect.poll(() => hiddenNamed("phone").value).toBe("+12642351");
      expect(phoneInput().value).toBe("2642351");
      phoneInput().focus();
      phoneInput().setSelectionRange(7, 7);
      await userEvent.keyboard("234");
      expect(phoneInput().value).toBe(completed);
      expect(hiddenNamed("phone").value).toBe("+12642351234");
    }
  );

  it.each([
    { copied: " +46 701 234 567", formatOnType: false, display: "701234567" },
    { copied: " +46 701 234 567", formatOnType: true, display: "070-123 45 67" },
    { copied: "(+46) 70 123 45 67", formatOnType: false, display: "701234567" },
    { copied: "(+46) 70 123 45 67", formatOnType: true, display: "070-123 45 67" },
  ])(
    "detects a pasted '$copied' from Norway, formatOnType $formatOnType",
    async ({ copied, formatOnType, display }) => {
      renderField(<PhoneNumberField label="Mobile" name="phone" formatOnType={formatOnType} />);
      expect(roleNamed("button", "Select country").textContent).toContain("+47");
      paste(copied);
      await expect.poll(() => hiddenNamed("phone").value).toBe("+46701234567");
      expect(phoneInput().value).toBe(display);
      expect(roleNamed("button", "Select country").textContent).toContain("+46");
    }
  );

  it("keeps the national format of a detected number through a preserving country change", async () => {
    renderField(<PhoneNumberField label="Mobile" name="phone" formatOnType preserveOnCountryChange />);
    paste("+46701234567");
    await expect.poll(() => phoneInput().value).toBe("070-123 45 67");
    await selectCountry("Finland");
    expect(phoneInput().value).toBe("070 1234567");
    expect(hiddenNamed("phone").value).toBe("+358701234567");
  });
});

describe("PhoneNumberField caret", () => {
  /** Types the keys one at a time at the caret, as a user does. */
  async function typeKeys(keys: string) {
    for (const key of keys) {
      await userEvent.keyboard(key);
    }
  }

  function caretAt(offset: number) {
    phoneInput().focus();
    phoneInput().setSelectionRange(offset, offset);
  }

  it.each([
    { mode: "uncontrolled", controlled: false },
    { mode: "controlled", controlled: true },
  ])("keeps the caret among the digits through a reformatting edit, $mode", async ({ controlled }) => {
    const Field = controlled ? ControlledField : PhoneNumberField;
    renderField(
      <form aria-label="Phone form">
        <Field label="Mobile" name="phone" formatOnType />
      </form>
    );
    const input = phoneInput();
    const caret = () => [input.selectionStart, input.selectionEnd];

    // Backspace after the 2 deletes it, and the caret stays after "91".
    caretAt(0);
    await typeKeys("91234567");
    expect(input.value).toBe("91 23 45 67");
    caretAt(4);
    await userEvent.keyboard("{Backspace}");
    expect(input.value).toBe("91 34 56 7");
    expect(caret()).toEqual([2, 2]);
    await typeKeys("5");
    expect(input.value).toBe("91 53 45 67");
    expect(caret()).toEqual([4, 4]);
    expect(phoneSubmission().get("phone")).toBe("+4791534567");

    // Backspace after a space deletes only the space, which comes back; the caret stays after "91".
    caretAt(3);
    await userEvent.keyboard("{Backspace}");
    expect(input.value).toBe("91 53 45 67");
    expect(caret()).toEqual([2, 2]);
    await typeKeys("0");
    expect(input.value).toBe("910534567");
    expect(caret()).toEqual([3, 3]);
    expect(phoneSubmission().get("phone")).toBe("+47910534567");

    // A digit typed after the first one of a shorter number lands there.
    await userEvent.keyboard("{End}{Backspace}{Backspace}");
    expect(input.value).toBe("91 05 34 5");
    caretAt(1);
    await typeKeys("4");
    expect(input.value).toBe("94 10 53 45");
    expect(caret()).toEqual([2, 2]);
    expect(phoneSubmission().get("phone")).toBe("+4794105345");
  });

  it.each([
    { mode: "uncontrolled", controlled: false },
    { mode: "controlled", controlled: true },
  ])(
    "keeps the caret after the calling code an international display adds, $mode",
    async ({ controlled }) => {
      const Field = controlled ? ControlledField : PhoneNumberField;
      renderField(
        <form aria-label="Phone form">
          <Field label="Mobile" name="phone" international formatOnType />
        </form>
      );
      const input = phoneInput();
      caretAt(0);
      const shown: string[] = [];
      for (const key of "91234567") {
        await userEvent.keyboard(key);
        shown.push(input.value);
        expect(input.selectionStart, input.value).toBe(input.value.length);
      }
      expect(shown).toEqual([
        "+47 9",
        "+47 91",
        "+47 912",
        "+47 9123",
        "+47 91234",
        "+47 912345",
        "+47 9123456",
        "+47 91 23 45 67",
      ]);
      expect(phoneSubmission().get("phone")).toBe("+4791234567");

      // Backspace after the 2, then a 5 in its place.
      caretAt(8);
      await userEvent.keyboard("{Backspace}");
      expect(input.value).toBe("+47 9134567");
      expect(input.selectionStart).toBe(6);
      await typeKeys("5");
      expect(input.value).toBe("+47 91 53 45 67");
      expect(input.selectionStart).toBe(8);
      expect(phoneSubmission().get("phone")).toBe("+4791534567");
    }
  );

  it("keeps the caret before the next digit through forward deletes", async () => {
    renderField(
      <form aria-label="Phone form">
        <PhoneNumberField label="Mobile" name="phone" formatOnType />
      </form>
    );
    const input = phoneInput();
    caretAt(0);
    await typeKeys("91234567");
    // Delete after the space removes the 2, and the caret waits before the 3.
    caretAt(3);
    await userEvent.keyboard("{Delete}");
    expect(input.value).toBe("91 34 56 7");
    expect(input.selectionStart).toBe(3);
    await userEvent.keyboard("{Delete}");
    expect(input.value).toBe("91 45 67");
    expect(input.selectionStart).toBe(3);
    // Delete before a space removes only the space, which comes back; the next Delete still
    // reaches the digit after it.
    caretAt(2);
    await userEvent.keyboard("{Delete}");
    expect(input.value).toBe("91 45 67");
    expect(input.selectionStart).toBe(3);
    await userEvent.keyboard("{Delete}");
    expect(input.value).toBe("91 56 7");
    expect(input.selectionStart).toBe(3);
    expect(phoneSubmission().get("phone")).toBe("+4791567");
  });

  it("keeps the caret when the parent commits the edit synchronously", async () => {
    function Synchronous() {
      const [value, setValue] = useState("");
      return (
        <form aria-label="Phone form">
          <PhoneNumberField
            label="Mobile"
            name="phone"
            value={value}
            onChange={(next) => flushSync(() => setValue(next))}
            formatOnType
          />
        </form>
      );
    }
    renderField(<Synchronous />);
    const input = phoneInput();
    caretAt(0);
    await typeKeys("91234567");
    caretAt(4);
    await userEvent.keyboard("{Backspace}");
    expect(input.value).toBe("91 34 56 7");
    expect(input.selectionStart).toBe(2);
    await typeKeys("5");
    expect(input.value).toBe("91 53 45 67");
    expect(phoneSubmission().get("phone")).toBe("+4791534567");
  });

  it("keeps the caret for a field inside a shadow root", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const mountPoint = document.createElement("div");
    host.attachShadow({ mode: "open" }).append(mountPoint);
    try {
      renderField(createPortal(<PhoneNumberField label="Mobile" formatOnType />, mountPoint));
      const input = phoneInput();
      caretAt(0);
      await typeKeys("91234567");
      expect(input.value).toBe("91 23 45 67");
      caretAt(4);
      await userEvent.keyboard("{Backspace}");
      expect(input.value).toBe("91 34 56 7");
      expect(input.selectionStart).toBe(2);
    } finally {
      host.remove();
    }
  });

  it("keeps the caret where a separator typed into an unformatted number was dropped", async () => {
    renderField(
      <form aria-label="Phone form">
        <PhoneNumberField label="Mobile" name="phone" />
      </form>
    );
    const input = phoneInput();
    caretAt(0);
    await typeKeys("41234567");
    caretAt(2);
    await typeKeys("-");
    expect(input.value).toBe("41234567");
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2]);
    await typeKeys("9");
    expect(input.value).toBe("419234567");
  });

  it("leaves the caret alone when the parent rejects the edit", async () => {
    const proposals: string[] = [];
    renderField(
      <PhoneNumberField
        label="Mobile"
        value="+4791234567"
        onChange={(next) => proposals.push(next)}
        formatOnType
      />
    );
    const input = phoneInput();
    expect(input.value).toBe("91 23 45 67");
    caretAt(4);
    await userEvent.keyboard("{Backspace}");
    expect(proposals).toEqual(["+479134567"]);
    expect(input.value).toBe("91 23 45 67");
    // Not the edit's caret, after "91", but where Chromium leaves an assigned value's caret.
    expect([input.selectionStart, input.selectionEnd]).toEqual([11, 11]);
  });

  it("leaves the caret alone when the parent replaces the edit", async () => {
    function Replacing() {
      const [value, setValue] = useState("+4791234567");
      return (
        <form aria-label="Phone form">
          <PhoneNumberField
            label="Mobile"
            name="phone"
            value={value}
            onChange={(next) => setValue(next === "+479134567" ? "+4799999999" : next)}
            formatOnType
          />
        </form>
      );
    }
    renderField(<Replacing />);
    const input = phoneInput();
    caretAt(4);
    await userEvent.keyboard("{Backspace}");
    expect(input.value).toBe("99 99 99 99");
    expect(phoneSubmission().get("phone")).toBe("+4799999999");
    expect([input.selectionStart, input.selectionEnd]).toEqual([11, 11]);
  });
});
