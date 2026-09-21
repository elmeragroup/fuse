import { expect, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { formNamed, inputNamed, roleNamed } from "./themed-browser-render";

/** The phone fixtures all label the number input "Mobile" and the form "Phone form". */
export function phoneInput(name = "Mobile"): HTMLInputElement {
  return inputNamed(name);
}

export function phoneForm(name = "Phone form"): HTMLFormElement {
  return formNamed(name);
}

export function phoneSubmission(name = "Phone form"): FormData {
  return new FormData(phoneForm(name));
}

export function countrySearch(name = "Search countries"): HTMLInputElement {
  const named = roleNamed("combobox", name);
  if (!(named instanceof HTMLInputElement)) {
    throw new Error(`expected search ${name}`);
  }
  return named;
}

/** The open country picker's option list; the only listbox a phone fixture renders. */
export function countryListbox(): HTMLElement {
  const element = page.getByRole("listbox").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the country listbox");
  }
  return element;
}

/** Opens the country picker from the keyboard and resolves once its listbox is in the DOM. */
export async function openPicker(trigger = "Select country"): Promise<HTMLElement> {
  roleNamed("button", trigger).focus();
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => {
    expect(page.getByRole("listbox").query()).not.toBeNull();
  });
  return countryListbox();
}

/**
 * Opens the picker, filters the list to `country`, and commits the first match from the
 * keyboard; resolves once the popup has closed again.
 */
export async function selectCountry(
  country: string,
  labels: { trigger?: string; search?: string } = {}
): Promise<void> {
  await openPicker(labels.trigger);
  await userEvent.fill(countrySearch(labels.search), country);
  await vi.waitFor(() => {
    // Substring match on purpose: the option's accessible name appends the calling code.
    expect(page.getByRole("option", { name: country, exact: false }).query()).not.toBeNull();
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await vi.waitFor(() => {
    expect(page.getByRole("listbox").query()).toBeNull();
  });
}
