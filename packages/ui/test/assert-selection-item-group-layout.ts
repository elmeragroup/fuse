import type { CSSProperties } from "react";

import { expect } from "vitest";
import { page } from "vitest/browser";

/** Browser suites load styles.css only; shell radius reads `--radius` (badge.md precedent). */
// SAFETY: React's CSSProperties does not model custom properties; the value is a plain string.
const radiusToken = { "--radius": "8px" } as CSSProperties;

export { radiusToken };

function tokenGap(host: HTMLElement, utility: string): string {
  const probe = document.createElement("div");
  probe.className = `flex ${utility}`;
  host.append(probe);
  const gap = getComputedStyle(probe).columnGap;
  probe.remove();
  return gap;
}

function tokenRadius(host: HTMLElement, utility: string): string {
  const probe = document.createElement("div");
  probe.className = utility;
  host.append(probe);
  const radius = getComputedStyle(probe).borderTopLeftRadius;
  probe.remove();
  return radius;
}

export function listitemHosts(): [HTMLElement, HTMLElement] {
  const items = page.getByRole("listitem").elements();
  expect(items).toHaveLength(2);
  const [first, second] = items;
  if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) {
    throw new Error("expected two listitem hosts");
  }
  return [first, second];
}

export function assertDirectSiblingList(first: HTMLElement, second: HTMLElement): HTMLElement {
  const list = first.parentElement;
  expect(list).toBe(page.getByRole("list").element());
  expect(second.parentElement).toBe(list);
  if (!(list instanceof HTMLElement)) {
    throw new Error("expected the list to host both listitems");
  }
  return list;
}

export function assertConnectedVerticalList(
  list: HTMLElement,
  first: HTMLElement,
  second: HTMLElement
): void {
  const listStyle = getComputedStyle(list);
  expect(listStyle.flexDirection).toBe("column");
  expect(listStyle.flexWrap).not.toBe("wrap");
  expect(listStyle.columnGap).toBe(tokenGap(list, "gap-0"));
  expect(listStyle.rowGap).toBe(tokenGap(list, "gap-0"));
  expect(getComputedStyle(first).borderTopLeftRadius).toBe(tokenRadius(first, "rounded-lg"));
  expect(getComputedStyle(first).borderBottomLeftRadius).toBe("0px");
  expect(getComputedStyle(second).borderTopLeftRadius).toBe("0px");
  expect(getComputedStyle(second).borderBottomLeftRadius).toBe(tokenRadius(second, "rounded-lg"));
  expect(getComputedStyle(second).borderTopWidth).not.toBe("0px");
  expect(getComputedStyle(second).marginTop).toBe("-1px");
  expect(getComputedStyle(first).marginTop).not.toBe("-1px");
}

export function assertHorizontalItemList(list: HTMLElement, items: HTMLElement[]): void {
  const listStyle = getComputedStyle(list);
  expect(listStyle.flexDirection).toBe("row");
  expect(listStyle.flexWrap).toBe("wrap");
  expect(listStyle.columnGap).toBe(tokenGap(list, "gap-4"));
  expect(listStyle.rowGap).toBe(tokenGap(list, "gap-4"));
  for (const item of items) {
    const style = getComputedStyle(item);
    const radius = tokenRadius(item, "rounded-lg");
    expect(radius).not.toBe("0px");
    expect(style.borderTopWidth).not.toBe("0px");
    expect(style.borderRightWidth).not.toBe("0px");
    expect(style.borderBottomWidth).not.toBe("0px");
    expect(style.borderLeftWidth).not.toBe("0px");
    expect(style.borderTopLeftRadius).toBe(radius);
    expect(style.borderTopRightRadius).toBe(radius);
    expect(style.borderBottomLeftRadius).toBe(radius);
    expect(style.borderBottomRightRadius).toBe(radius);
    expect(style.marginTop).not.toBe("-1px");
  }
}
