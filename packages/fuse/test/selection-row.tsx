import { page } from "vitest/browser";

import { SelectionItem } from "../src/components/selection-item";
import { headingNamed } from "./themed-browser-render";

export function checkboxNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("checkbox", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox named ${name}`);
  }
  return element;
}

export function shellFrom(name: string): HTMLElement {
  const heading = headingNamed(name);
  const shell = heading.closest("[data-selection-item]");
  if (shell instanceof HTMLElement) {
    return shell;
  }
  const article = heading.closest("article");
  if (article instanceof HTMLElement) {
    return article;
  }
  throw new Error(`expected checkbox-item shell around ${name}`);
}

/** Let the shell's color transition settle, so computed colors are the end state. */
export async function settled(element: HTMLElement): Promise<void> {
  await Promise.all(element.getAnimations().map((animation) => animation.finished));
}

export function RowTitle({ children }: { children: string }) {
  return (
    <SelectionItem.Title role="heading" aria-level={3}>
      {children}
    </SelectionItem.Title>
  );
}
