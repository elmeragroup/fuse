/** The distinct, non-empty texts an element's `aria-describedby` points at. */
export function describedTextsFor(element: HTMLElement): string[] {
  const ids = (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return [
    ...new Set(ids.map((id) => document.getElementById(id)?.textContent ?? "").filter((text) => text !== "")),
  ];
}
