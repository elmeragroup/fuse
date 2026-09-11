import { roleNamed, textboxNamed } from "./themed-browser-render";

/** The canonical textbox query, narrowed: phone suites read `.value` off the input itself. */
export function inputNamed(name = "Mobile"): HTMLInputElement {
  const input = textboxNamed(name);
  if (!(input instanceof HTMLInputElement)) throw new Error("Expected phone input");
  return input;
}

/** The canonical phone form query; the fixtures all label it "Phone form". */
export function formNamed(name = "Phone form"): HTMLFormElement {
  const form = roleNamed("form", name);
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected phone form");
  return form;
}

export function submission(name = "Phone form"): FormData {
  return new FormData(formNamed(name));
}

export function searchNamed(name = "Search countries"): HTMLInputElement {
  const named = roleNamed("combobox", name);
  if (!(named instanceof HTMLInputElement)) {
    throw new Error(`expected search ${name}`);
  }
  return named;
}
