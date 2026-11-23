/**
 * The cascade of a box's pseudo-elements over the box: an `<input>`'s `::placeholder`, whose text
 * style the box's own text takes, and its `::before` and `::after`, which the mapping draws as
 * layers of their own or notes as `pseudo-elements.ts` says. `capture-box-cascade.ts` reads both
 * for each box.
 */

import { routed } from "../components/coverage-log.ts";
import { inheritance, inheritsProperty, LayerStyle } from "../components/layer-style.ts";
import type { Applied, CellLedger, Layer } from "../components/layer-style.ts";
import { appliedOf, splitBorders } from "./cell-read.ts";
import type { CellRead, Placed } from "./cell-read.ts";
import { pseudoVerdict } from "./pseudo-elements.ts";

/**
 * The declarations of an `<input>`'s `::placeholder`, where it shows its placeholder: it has one and
 * no value. The kit draws the placeholder as the box's own text, so its text style applies on the box
 * after the box's own declarations, and the rest, such as its opacity, drops.
 */
export function placeholderOf(read: CellRead, ledger: CellLedger, path: readonly Placed[]): Applied[] {
  const element = path.at(-1)?.element;
  const declarations = element?.pseudo.placeholder;
  if (
    element === undefined ||
    declarations === undefined ||
    element.attributes.placeholder === undefined ||
    (element.attributes.value ?? "") !== ""
  ) {
    return [];
  }
  const text = (property: string) => inheritsProperty(property, read.context);
  const applied = appliedOf(read, declarations, path, () => true, "::placeholder");
  for (const {
    part,
    className,
    origin,
    declarations: [declaration],
  } of applied) {
    if (declaration !== undefined && !text(declaration.property)) {
      routed(
        ledger.scope.inPlace,
        origin
      )({
        part,
        className,
        property: declaration.property,
        value: declaration.value,
        outcome: "dropped",
        detail:
          "the kit draws the placeholder as the box's own text, which takes the placeholder's text style and not its box's",
      });
    }
  }
  return applied
    .filter(({ declarations: [declaration] }) => declaration !== undefined && text(declaration.property))
    .map((each) => ({ ...each, order: element.declarations.length + each.order }));
}

/** A box's pseudo-element the mapping draws as a layer of its own, with its cascaded style. */
export type DrawnPseudo = { readonly pseudo: "before" | "after"; readonly style: LayerStyle };

/**
 * Cascade a box's `::before` and `::after` over the box, as the browser does. One that paints, with
 * every longhand it sets one the build reads, and that the capture measured as an absolute box laid
 * out against the box in every mode (`pseudoBoxes`), is the mapping's to draw as a layer of its own.
 * Every other one notes each declaration it sets itself as `pseudoVerdict` says.
 *
 * @returns The pseudo-elements the mapping draws, `::before` first.
 */
export function readPseudoElements(
  read: CellRead,
  ledger: CellLedger,
  placed: readonly Placed[],
  layer: Layer,
  path: readonly string[]
): readonly DrawnPseudo[] {
  const own = placed.at(-1)?.element;
  const boxes: ReadonlySet<string> = new Set(own?.measured?.pseudoBoxes ?? []);
  const drawn: DrawnPseudo[] = [];
  for (const [pseudo, indexes] of Object.entries(own?.pseudo ?? {})) {
    if (pseudo === "placeholder") {
      continue;
    }
    const inherited = inheritance(layer, read.context);
    const applied = splitBorders(
      ledger.scope,
      inherited,
      appliedOf(read, indexes, placed, () => true, `::${pseudo}`)
    );
    const pseudoLayer = ledger.add(inherited, applied, layer);
    const style = new LayerStyle(ledger, pseudoLayer, [...path, `::${pseudo}`]);
    const { paints, ...note } = pseudoVerdict(style, pseudo, read.context.variables);
    if (paints && (pseudo === "before" || pseudo === "after") && boxes.has(pseudo)) {
      drawn.push({ pseudo, style });
      continue;
    }
    for (const property of style.ownProperties()) {
      style.mark(property, note.outcome, note.detail, []);
    }
  }
  return drawn.toSorted((left, right) => Number(left.pseudo === "after") - Number(right.pseudo === "after"));
}
