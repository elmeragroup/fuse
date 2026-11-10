import { useState } from "react";
import type { ReactNode } from "react";

import type { MetadataJson } from "libphonenumber-js/core";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

import "../../../dist/styles.css";
import { assertNoAxeViolations } from "../../../test/axe";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  countryListbox,
  countrySearch,
  openPicker,
  phoneInput,
  phoneSubmission,
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
  // The E.164 submit control is type=hidden, so it has no role.
  const match = document.body.querySelector(`input[type="hidden"][name="${name}"]`);
  if (!(match instanceof HTMLInputElement)) {
    throw new Error(`expected hidden input ${name}`);
  }
  return match;
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

  it("submits no display-value key when name is unset", async () => {
    renderField(
      <form aria-label="Phone form">
        <PhoneNumberField label="Mobile" />
      </form>
    );
    await userEvent.fill(page.getByRole("textbox", { name: "Mobile", exact: true }), "41234567");
    expect([...new FormData(formNamed("Phone form")).keys()]).toEqual([]);
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

  it("renders dictionary defaults in all four locales, describes the trigger's country in each, and lets override props win", async () => {
    const described = {
      "nb-NO": "Land: Norge +47",
      "sv-SE": "Land: Norge +47",
      "en-US": "Country: Norway +47",
      "fi-FI": "Maa: Norja +47",
    } as const;
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderField(<PhoneNumberField label="Mobile" />, locale);
      await expect
        .element(roleNamed("button", SELECT_COUNTRY_COPY[locale]))
        .toHaveAccessibleDescription(described[locale]);
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
    // The option's flag image is decorative, so it has no role of its own.
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

describe("PhoneNumberField countries", () => {
  it("offers only the listed countries and falls back from a default outside them", async () => {
    renderField(<PhoneNumberField label="Mobile" countries={["SE", "NO", "FI"]} defaultCountryCode="DK" />);
    // Norway, the fallback before the first country, is listed.
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
    await openPicker();
    // Finland, Norway, Sweden: name order, not the list's.
    expect(optionFlagCodes()).toEqual(["FI", "NO", "SE"]);
  });
});

describe("PhoneNumberField caret", () => {
  it("keeps the caret where a mid-number edit leaves it while formatOnType reformats", async () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <form aria-label="Phone form">
          <PhoneNumberField label="Mobile" name="phone" value={value} onChange={setValue} formatOnType />
        </form>
      );
    }
    renderField(<Controlled />);
    const input = phoneInput();
    input.focus();
    for (const key of "91234567") await userEvent.keyboard(key);
    expect(input.value).toBe("91 23 45 67");

    // Backspace after "91 2" removes the 2; formatting regroups the rest, and the caret stays
    // after "91", not at the end where a rewritten value would leave it.
    input.setSelectionRange(4, 4);
    await userEvent.keyboard("{Backspace}");
    await expect.element(input).toHaveValue("91 34 56 7");
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2]);
    await userEvent.keyboard("5");
    await expect.element(input).toHaveValue("91 53 45 67");
    // The 5 went in after "91 ", so the caret sits after it: offset 4.
    expect([input.selectionStart, input.selectionEnd]).toEqual([4, 4]);
    expect(phoneSubmission().get("phone")).toBe("+4791534567");
  });
});
