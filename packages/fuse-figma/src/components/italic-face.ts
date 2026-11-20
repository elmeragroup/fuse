/**
 * A label's `font-style: italic`, as DateInput's placeholder segments set it. CSS picks the family's
 * italic face for it (CSS Fonts 4 §5.2), and a Figma text layer names its face in its font style, such
 * as `Medium Italic`. The kit sets body text in Roboto in every theme, which `font-sans` binds, and
 * Roboto ships an italic face for each upright weight, in Figma and in `@fontsource/roboto`, which the
 * capture and compare page loads. So an italic label whose family binds `font-sans` draws in the
 * italic face of its weight. Any other family, which may lack an italic face and leave the browser to
 * slant the upright one, keeps `font-style` unmapped, and so does `oblique`, which names a slant and
 * not a face.
 */
import { KIT_BODY_FAMILY } from "../kit-fonts";
import { normalizeCss } from "./css-values";
import type { StringSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The font variable whose family is {@link KIT_BODY_FAMILY} in every theme. */
const BODY_FONT = "font-sans";

/**
 * Whether a label's family is the kit's body family in every theme.
 *
 * @param family - The label's font family, as `readType` read it.
 * @returns True where the family binds `font-sans` or is Roboto itself.
 */
function isBodyFamily(family: StringSpec | undefined): boolean {
  return family?.kind === "variable" ? family.variable.name === BODY_FONT : family?.value === KIT_BODY_FAMILY;
}

/**
 * The italic face of an upright Figma font style: `Italic` for `Regular`, and the weight's name before
 * ` Italic` for any other, as Roboto names its faces.
 *
 * @param upright - The upright style, such as `Regular` or `Medium`.
 * @returns The italic style.
 */
function italicStyle(upright: string): string {
  return upright === "Regular" ? "Italic" : `${upright} Italic`;
}

/**
 * The Figma font style a label draws in: its weight's upright style, or that weight's italic face
 * where its `font-style` resolves to `italic` and its family is the body family, as the module doc
 * says. A label whose `font-style` resolves to anything but `italic` reads nothing here.
 *
 * @param style - The label's box's style.
 * @param type - The label's font family and the upright style its weight maps to.
 * @param path - The keys of the label's layer.
 * @returns The font style.
 */
export function readFaceStyle(
  style: LayerStyle,
  type: { readonly family: StringSpec | undefined; readonly upright: string },
  path: readonly string[]
): string {
  if (normalizeCss(style.resolved("font-style") ?? "normal") !== "italic") {
    return type.upright;
  }
  const italic = style.read(
    "font-style",
    (value) =>
      normalizeCss(value) === "italic" && isBodyFamily(type.family) ? italicStyle(type.upright) : undefined,
    (face) => ({
      outcome: "literal",
      detail: `font style ${face}, the italic face Roboto ships for the weight`,
    }),
    style.feed("fontStyle", path)
  );
  return italic ?? type.upright;
}
