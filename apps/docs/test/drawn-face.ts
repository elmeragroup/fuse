import type { Locator } from "playwright";

/**
 * The face an element's text draws in: the first family of its computed `font-family`, by the name
 * of the `next/font` loader that declared it. `next/font` names a face after the variable it is
 * assigned to, `inter` in `components/site-fonts.ts`, and a webpack build hashes that name, as
 * `__inter_1a2b3c`, so the result drops the hash, the quotes and the case.
 *
 * @param locator - The element to read.
 * @returns The face's loader name, such as `inter` or `roboto`.
 */
export async function drawnFace(locator: Locator): Promise<string> {
  const family = await locator.evaluate(
    (element) => getComputedStyle(element).fontFamily.split(",")[0] ?? ""
  );
  return family
    .trim()
    .replaceAll(/["']/g, "")
    .replace(/^__/u, "")
    .replace(/_[0-9a-f]{6}$/u, "")
    .toLowerCase();
}
