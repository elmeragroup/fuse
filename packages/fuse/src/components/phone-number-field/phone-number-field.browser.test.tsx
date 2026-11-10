import type { ReactNode } from "react";

import type { MetadataJson } from "libphonenumber-js/core";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

import "../../../dist/styles.css";
import { assertNoAxeViolations } from "../../../test/axe";
import { withLocale } from "../../../test/locale-matrix";
import type { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import {
  countryListbox,
  countrySearch,
  openPicker,
  selectCountry,
} from "../../../test/phone-browser-queries";
import {
  fieldRootFrom,
  formNamed,
  renderThemed,
  roleNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
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

function renderField(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
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

describe("PhoneNumberField", () => {
  it("names the country trigger independently of the Field label", () => {
    renderField(<PhoneNumberField label="Mobile" />);
    expect(roleNamed("button", "Select country")).toBeTruthy();
    expect(page.getByRole("button", { name: "Mobile", exact: true }).query()).toBeNull();
    expect(textboxNamed("Mobile")).toBeTruthy();
    expect(textboxNamed("Mobile")).toHaveProperty("inputMode", "tel");
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

  it("puts no aria-readonly on the read-only trigger, which the button role does not support", async () => {
    const { host } = renderField(<PhoneNumberField label="Mobile" isReadOnly />);
    expect(roleNamed("button", "Select country").hasAttribute("aria-readonly")).toBe(false);
    // The trigger's name leaves out its visible dial code (WCAG 2.5.3); #246 tracks it.
    await assertNoAxeViolations(host, ["label-content-name-mismatch"]);
  });

  it("names only the selected country through Intl.DisplayNames until the country popup opens", async () => {
    resetCountryNameCache();
    const ofSpy = vi.spyOn(Intl.DisplayNames.prototype, "of");
    try {
      renderField(<PhoneNumberField label="Mobile" />);
      // The trigger's description names the selected country; the rows wait for the popup.
      expect(ofSpy.mock.calls).toEqual([["NO"]]);
      await openPicker();
      expect(ofSpy.mock.calls.length).toBeGreaterThan(1);
    } finally {
      ofSpy.mockRestore();
      resetCountryNameCache();
    }
  });

  it("selects a country from the keyboard, closes, updates the dial code, and focuses the number input", async () => {
    renderField(<PhoneNumberField label="Mobile" />);
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
    await selectCountry("Sweden");
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    await expect
      .element(roleNamed("button", "Select country"))
      .toHaveAccessibleDescription("Country: Sweden +46");
    // Focus moves to the number input as the picker closes, which can land a frame later.
    await expect.element(page.getByRole("textbox", { name: "Mobile", exact: true })).toHaveFocus();
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

  it("submits no display-value key when name is unset", async () => {
    renderField(
      <form aria-label="Phone form">
        <PhoneNumberField label="Mobile" />
      </form>
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    expect([...new FormData(formNamed("Phone form")).keys()]).toEqual([]);
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
});
