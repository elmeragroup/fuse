import { roleNamed } from "./themed-browser-render";

export function inputNamed(name = "Mobile"): HTMLInputElement {
  const input = roleNamed("textbox", name);
  if (!(input instanceof HTMLInputElement)) throw new Error("Expected phone input");
  return input;
}

export function searchNamed(name = "Search countries"): HTMLInputElement {
  const named = document.body.querySelector(`input[aria-label="${name}"]`);
  if (named instanceof HTMLInputElement) {
    return named;
  }
  throw new Error(`expected search ${name}`);
}
