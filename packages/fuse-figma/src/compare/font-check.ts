/**
 * Whether the cells' text draws in a face the compare page loaded. The page reports each text
 * element's weight and font-family stack, and every face it loaded.
 */
import { Result } from "effect";

/** The cells' text uses a family the page has no loaded face for. */
export class FontNotLoaded extends Error {
  readonly _tag = "FontNotLoaded" as const;
}

/** A text element's weight and its computed `font-family` stack, each family as CSS writes it. */
export type UsedFont = { readonly weight: string; readonly families: readonly string[] };

/** A family as CSS names it, without its quotes. */
function unquote(family: string): string {
  return family.trim().replaceAll(/^["']|["']$/g, "");
}

/**
 * Check that each text element's first family has a loaded face at its weight. A licensed family
 * that neither the page nor the real file has passes where the next family in the element's stack has
 * a loaded face, since both sides then draw that fallback (CSS Fonts 4 §5), and the cell compares it.
 * Any other missing family stops the run.
 *
 * @param used - Each text element's weight and family stack.
 * @param loaded - Each loaded face, as `weight|family`.
 * @param licensed - The licensed families neither side has, by name, with why.
 * @returns The faces the text draws in, or why one is missing.
 */
export function checkUsedFonts(
  used: readonly UsedFont[],
  loaded: readonly string[],
  licensed: ReadonlyMap<string, string>
): Result.Result<string, FontNotLoaded> {
  const faces = new Set(
    loaded.map((entry) => {
      const [weight = "", family = ""] = entry.split("|");
      return `${weight}|${unquote(family)}`;
    })
  );
  const fonts = new Set<string>();
  for (const { weight, families } of used) {
    const family = unquote(families[0] ?? "");
    const fallback = unquote(families[1] ?? "");
    if (licensed.has(family) && faces.has(`${weight}|${fallback}`)) {
      fonts.add(`${weight} ${fallback} for ${family}`);
      continue;
    }
    if (!faces.has(`${weight}|${family}`)) {
      return Result.fail(
        new FontNotLoaded(
          `The cells' text uses ${family} at weight ${weight}, and the page has no loaded face for it. The comparison loads only @fontsource/roboto, so a theme whose --font-sans starts with another family needs that family added to page-assets.ts.`
        )
      );
    }
    fonts.add(`${weight} ${family}`);
  }
  return Result.succeed([...fonts].join(", "));
}
