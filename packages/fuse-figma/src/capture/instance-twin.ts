/**
 * Which set owns a declaration on an element at or below an instance part's inner root. The build
 * looks for each such element's twin in the inner set's own capture of the same inner cell, and the
 * inner set claims the declarations its own build keeps at the twin, box by box. The capture
 * build gives a declaration's rows to the innermost set that claims it and the rest to the composite,
 * and check 8 of the coverage oracle lets an inner set account for what it claims. Both read the
 * pairing and the claims from this module, so they cannot disagree on what an inner set claims.
 */
import type { CapturedDeclaration, CapturedElement } from "./capture-format.ts";

/**
 * The value of the declaration that wins a longhand among the given ones, or undefined.
 *
 * @param indexes - The winning declarations of one box, in cascade order, by index.
 * @param declarations - The capture's declarations.
 * @param longhand - The longhand.
 * @returns The value of the last declaration that sets the longhand.
 */
function winningValue(
  indexes: readonly number[],
  declarations: readonly CapturedDeclaration[],
  longhand: string
): string | undefined {
  return indexes
    .map((index) => declarations[index])
    .findLast((declaration) => declaration?.longhands.includes(longhand) === true)?.value;
}

/**
 * Whether a declaration comes from a style sheet every page applies to every element: Tailwind's
 * preflight, Fuse's base layer or the browser's own.
 *
 * @param declaration - The declaration.
 * @returns Whether its style sheet is one of those.
 */
export function isBase(declaration: CapturedDeclaration): boolean {
  return (
    declaration.source === "preflight" || declaration.source === "user-agent" || declaration.layer === "base"
  );
}

/**
 * Whether a declaration resets its longhands to their initial values from a style sheet every page
 * applies to every element, Tailwind's preflight, Fuse's base layer or the browser's own, as the
 * base layer's `margin: 0` does. A reset sets nothing a component draws, so the cascade leaves it out,
 * and a box reads such a longhand as unset.
 *
 * @param declaration - The declaration.
 * @param index - Its index into the capture's declarations.
 * @param initial - The element's own declarations whose longhands compute to their initial values.
 * @returns Whether the declaration is such a reset.
 */
export function isReset(
  declaration: CapturedDeclaration,
  index: number,
  initial: readonly number[]
): boolean {
  return isBase(declaration) && initial.includes(index);
}

/**
 * Whether an element's own winning declarations keep it and everything below it from rendering
 * anything visible: `display: none`, which generates no box for it or its descendants (CSS Display 3
 * §2.5), or a `clip-path: inset()` whose opposite insets meet on an element that generates a box,
 * which clips the box and its descendants to no area (CSS Masking 1 §6.1), as `sr-only` and Base UI's
 * visually hidden inputs clip theirs with `inset(50%)`. A `display: contents` element generates no
 * box, so its clip clips nothing and its children paint.
 *
 * @param element - The captured element.
 * @param declarations - The capture's declarations.
 * @returns Whether nothing at or below the element renders.
 */
export function rendersNothing(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[]
): boolean {
  const won = (longhand: string): string | undefined =>
    winningValue(element.declarations, declarations, longhand);
  const display = won("display")?.trim();
  if (display === "none") {
    return true;
  }
  const inset = /^inset\(([^)]*)\)$/.exec(won("clip-path")?.trim() ?? "");
  if (display === "contents" || inset === null) {
    return false;
  }
  const percents = (inset[1] ?? "")
    .trim()
    .split(/\s+/)
    .map((each) => (each === "0" ? "0" : /^(-?[\d.]+)%$/.exec(each)?.[1]));
  if (percents.some((each) => each === undefined)) {
    return false;
  }
  const [top = 0, right = top, bottom = top, left = right] = percents.map(Number);
  return top + bottom >= 100 || left + right >= 100;
}

/** Whether a pseudo-element's winning declarations, by index, give it `display: none`. */
function generatesNoBox(indexes: readonly number[], declarations: readonly CapturedDeclaration[]): boolean {
  return winningValue(indexes, declarations, "display")?.trim() === "none";
}

/** A declaration a set's own build keeps on one box of an element. */
export type KeptDeclaration = {
  /** The box it styles: "" for the element's own, `::before` for that pseudo-element's. */
  readonly box: string;
  /** Its index in the capture's declarations. */
  readonly index: number;
  readonly declaration: CapturedDeclaration;
};

/**
 * The declarations a set's own build keeps on an element, box by box: the element's own, then each
 * pseudo-element's, but none of a pseudo-element whose own `display` is `none`, which generates no box
 * (CSS Display 3 §2.5), so nothing it sets shows. A reset to the initial value is left out, as the
 * cascade leaves it out of the element's layer. Check 8 leaves out the browser's own style sheet as
 * well.
 *
 * @param element - The captured element, which renders something.
 * @param declarations - The capture's declarations.
 * @returns Each kept declaration with its box, the element's own first.
 */
export function keptDeclarations(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[]
): readonly KeptDeclaration[] {
  const boxes = [
    ["", element.declarations] as const,
    ...Object.entries(element.pseudo)
      .filter(([, indexes]) => !generatesNoBox(indexes, declarations))
      .map(([pseudo, indexes]) => [`::${pseudo}`, indexes] as const),
  ];
  return boxes.flatMap(([box, indexes]) =>
    indexes.flatMap((index) => {
      const declaration = declarations[index];
      // An element's `initial` lists its own declarations that reset a longhand, none of a pseudo-element's.
      return declaration === undefined || isReset(declaration, index, box === "" ? element.initial : [])
        ? []
        : [{ box, index, declaration }];
    })
  );
}

/**
 * A declaration on one box as an element and its twin compare it: the box, then the declaration's
 * class, property, value and style sheet.
 *
 * @param box - The box's name, as {@link keptDeclarations} names it.
 * @param declaration - The declaration.
 * @returns A key equal for the same declaration on the same box in either capture.
 */
export function boxIdentity(
  box: string,
  { className, property, value, source }: CapturedDeclaration
): string {
  return JSON.stringify([box, className, property, value, source]);
}

/**
 * The `data-slot` values of the nearest slotted elements below an element, in document order: what
 * tells one unslotted wrapper from another of the same tag.
 */
function slotsBelow(element: CapturedElement): readonly string[] {
  return element.children.flatMap((child) => {
    const slot = child.attributes["data-slot"];
    return slot === undefined ? slotsBelow(child) : [slot];
  });
}

/**
 * Pair the children of `composite` with those of `inner`, its twin, one to one. A slotted child pairs
 * with the inner child of the same `data-slot` at the same ordinal among the children that carry it,
 * since a composite can leave out a part the inner sample shows before it, as a menu row without an
 * icon holds its shortcut first. An unslotted child pairs with an unslotted child of the same tag that
 * holds the same slotted elements, at the same ordinal among those, so a wrapper only one capture holds
 * does not take the place of the wrapper around a part. Where the composite renders those slotted
 * elements in another order, the wrappers that hold the same ones, each as often, pair next. The
 * unslotted children still unpaired on both sides then pair by tag and ordinal, as a wrapper around
 * an optional part the composite leaves out.
 */
function pairChildren(
  composite: CapturedElement,
  inner: CapturedElement
): ReadonlyMap<CapturedElement, CapturedElement> {
  const paired = new Map<CapturedElement, CapturedElement>();
  const taken = new Set<CapturedElement>();
  const pairBy = (key: (each: CapturedElement) => string | undefined): void => {
    const groups = (children: readonly CapturedElement[]): Map<string, CapturedElement[]> => {
      const found = new Map<string, CapturedElement[]>();
      for (const child of children) {
        const at = key(child);
        if (at !== undefined) {
          found.set(at, [...(found.get(at) ?? []), child]);
        }
      }
      return found;
    };
    const there = groups(inner.children.filter((child) => !taken.has(child)));
    for (const [at, here] of groups(composite.children.filter((child) => !paired.has(child)))) {
      here.forEach((child, ordinal) => {
        const twin = there.get(at)?.[ordinal];
        if (twin !== undefined) {
          paired.set(child, twin);
          taken.add(twin);
        }
      });
    }
  };
  const slot = (each: CapturedElement): string | undefined => each.attributes["data-slot"];
  pairBy(slot);
  const unslotted =
    (signature: (slots: readonly string[]) => readonly string[]) =>
    (each: CapturedElement): string | undefined =>
      slot(each) === undefined ? JSON.stringify([each.tag, signature(slotsBelow(each))]) : undefined;
  pairBy(unslotted((slots) => slots));
  pairBy(unslotted((slots) => slots.toSorted()));
  pairBy((each) => (slot(each) === undefined ? each.tag : undefined));
  return paired;
}

/**
 * What the inner set claims at each element at or below an instance part's inner root in the
 * composite's capture: the {@link boxIdentity} of each declaration its own build keeps at the
 * element's twin. The inner root's twin is the inner set's root, and each child's is the one
 * {@link pairChildren} pairs it with. An element without a twin claims nothing, and neither does a
 * twin that renders nothing, nor anything below it, since check 8 of the inner set skips those.
 * A pseudo-element whose `display` is `none` at both the element and its twin is the inner set's as
 * well, so its build's row that says the pseudo-element generates no box is the only one.
 *
 * @param root - The instance part's inner root in the composite's capture.
 * @param own - The inner set's root in its own capture of the same inner cell.
 * @param declarations - The captured declarations of the inner set, then of the composite.
 * @returns The claimed identities of every element at or below `root`.
 */
export function twinClaims(
  root: CapturedElement,
  own: CapturedElement,
  declarations: {
    readonly inner: readonly CapturedDeclaration[];
    readonly composite: readonly CapturedDeclaration[];
  }
): ReadonlyMap<CapturedElement, ReadonlySet<string>> {
  const { inner, composite } = declarations;
  const found = new Map<CapturedElement, ReadonlySet<string>>();
  const visit = (here: CapturedElement, twin: CapturedElement | undefined): void => {
    const shown = twin === undefined || rendersNothing(twin, inner) ? undefined : twin;
    const hiddenInBoth = Object.entries(shown?.pseudo ?? {}).flatMap(([pseudo, indexes]) => {
      const there = here.pseudo[pseudo];
      return there !== undefined && generatesNoBox(indexes, inner) && generatesNoBox(there, composite)
        ? indexes.flatMap((index) => {
            const declaration = inner[index];
            return declaration === undefined ? [] : [boxIdentity(`::${pseudo}`, declaration)];
          })
        : [];
    });
    found.set(
      here,
      new Set([
        ...(shown === undefined
          ? []
          : keptDeclarations(shown, inner).map(({ box, declaration }) => boxIdentity(box, declaration))),
        ...hiddenInBoth,
      ])
    );
    const pairs =
      shown === undefined ? new Map<CapturedElement, CapturedElement>() : pairChildren(here, shown);
    for (const child of here.children) {
      visit(child, pairs.get(child));
    }
  };
  visit(root, own);
  return found;
}

/**
 * The origin that owns a declaration's rows: the innermost set that claims it on the same box of the
 * element that stands for the target. Only the sets whose markup holds the declaration's owner, the
 * element whose class set it, can apply it, so the walk starts at the owner's set and leaves out the
 * instances inside it. A set that does not claim the declaration hands it to the set that holds its
 * instance, so the composite owns what only its markup turns on, as Input group's `data-invalid:`
 * turns on its button's `data-invalid:border-error`, and a holder owns its own class on a nested
 * instance's root where its own capture applies it there.
 *
 * @template Origin - What owns a row.
 * @param owner - The owner's origin, and the origin of the set that holds each instance part around
 *   it, innermost first.
 * @param claims - What each instance part around the target claims at it, innermost first, as
 *   {@link twinClaims} finds it. The outermost ones are the instance parts around the owner.
 * @param box - The box the declaration styles, as {@link keptDeclarations} names it.
 * @param declaration - The declaration.
 * @returns The origin that owns its rows.
 */
export function declarationOrigin<Origin>(
  owner: { readonly origin: Origin; readonly holders: readonly Origin[] },
  claims: readonly ReadonlySet<string>[],
  box: string,
  declaration: CapturedDeclaration
): Origin {
  const identity = boxIdentity(box, declaration);
  const around = claims.slice(Math.max(0, claims.length - owner.holders.length));
  let origin = owner.origin;
  for (const [level, claimed] of around.entries()) {
    if (claimed.has(identity)) {
      return origin;
    }
    origin = owner.holders[level] ?? origin;
  }
  return origin;
}
