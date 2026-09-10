import { roleNamed, textboxNamed } from "./themed-browser-render";

/** The canonical textbox query, narrowed: phone suites read `.value` off the input itself. */
export function inputNamed(name = "Mobile"): HTMLInputElement {
  const input = textboxNamed(name);
  if (!(input instanceof HTMLInputElement)) throw new Error("Expected phone input");
  return input;
}

export function searchNamed(name = "Search countries"): HTMLInputElement {
  const named = roleNamed("combobox", name);
  if (!(named instanceof HTMLInputElement)) {
    throw new Error(`expected search ${name}`);
  }
  return named;
}
