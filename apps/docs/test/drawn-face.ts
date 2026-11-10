import type { Locator, Page } from "playwright";

/** The variables the docs hold their loaded faces in (`components/site-fonts.ts`). */
const FACE_VARIABLES = ["--font-inter", "--font-roboto"] as const;

type FaceVariable = (typeof FACE_VARIABLES)[number];

/**
 * The `font-family` a face variable computes to: a probe set to `font-family: var(<variable>)`,
 * read as the browser serializes it, so it compares with an element's computed `font-family`
 * without reading the generated family names inside.
 *
 * @param page - The page whose root holds the variables.
 * @param variable - The face variable.
 * @returns The computed family list.
 */
async function faceFamilies(page: Page, variable: FaceVariable): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.fontFamily = `var(${name})`;
    document.body.append(probe);
    const families = getComputedStyle(probe).fontFamily;
    probe.remove();
    return families;
  }, variable);
}

/**
 * The first family of a computed `font-family`, without quotes, such as the family `next/font`
 * generated for a face.
 *
 * @param families - A computed family list.
 * @returns Its first family, or `""` for an empty list.
 */
export function firstFamily(families: string): string {
  return (families.split(",")[0] ?? "").trim().replaceAll(/^["']|["']$/gu, "");
}

/**
 * The face variable an element draws its text in: the one whose computed families start the
 * element's computed `font-family`, or the element's `font-family` itself when none does, so a
 * failing assertion shows what the element draws.
 *
 * @param locator - The element to read.
 * @returns The face variable's name, such as `--font-inter`, or the element's own stack.
 */
export async function drawnFace(locator: Locator): Promise<string> {
  const own = await locator.evaluate((element) => getComputedStyle(element).fontFamily);
  for (const variable of FACE_VARIABLES) {
    const families = await faceFamilies(locator.page(), variable);
    if (families !== "" && (own === families || own.startsWith(`${families},`))) {
      return variable;
    }
  }
  return own;
}
