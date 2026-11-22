/**
 * The cascade of one box, the root or a part, read from its element in the capture, as the mapping
 * reads it through {@link BoxCascade}: its layer, the spacing its children win through its class,
 * the cascades of the parts, instance parts and icons below it, and its label's text and runs.
 * `part-elements.ts` finds the elements of its parts, `pseudo-cascade.ts` cascades its
 * pseudo-elements, and `measured-box.ts` reads what the capture measured of it.
 *
 * - A part is the element below its box with the part's `data-slot`, or, for a part without one, the
 *   element at the part's place: the element-ordinal path from the nearest element with a `data-slot`,
 *   such as `field/1/0`. The elements between a box and its part pass down what they inherit.
 * - An instance part's inner root is the element below its box with the inner root's `data-slot`.
 *   The build looks for each element's twin there in the inner set's own capture of the same inner
 *   cell, as `instance-twin.ts` pairs them.
 */

import { childSpacingNote } from "../components/box-cascade.ts";
import type {
  BoxCascade,
  CapturedText,
  IconCascade,
  TextRun,
  ChildSpacing,
  InstanceScope,
  PartElement,
  MeasuredBox,
  PseudoCascade,
} from "../components/box-cascade.ts";
import { KitUnmappable } from "../components/build-errors.ts";
import type { PreviewLength, IconSlot } from "../components/component-spec.ts";
import { routed } from "../components/coverage-log.ts";
import type { Origin } from "../components/coverage-log.ts";
import type { CapturedAt } from "../components/coverage.ts";
import { normalizeCss } from "../components/css-values.ts";
import type { DrawnAt } from "../components/drawn-parts.ts";
import type { NumberSpec } from "../components/kit-spec.ts";
import { inheritance, inheritsProperty, LayerStyle } from "../components/layer-style.ts";
import type {
  Applied,
  CellLedger,
  CellScope,
  CoverageNote,
  InPlace,
  Layer,
} from "../components/layer-style.ts";
import { linkTarget } from "../components/link-target.ts";
import type { CapturedDeclaration, CapturedElement } from "./capture-format.ts";
import { appliedOf, atOf, ownDeclarations, placedBelow, spacingByChild, undrawnName } from "./cell-read.ts";
import type { CellRead, Placed } from "./cell-read.ts";
import { declarationOrigin, isBase, twinClaims } from "./instance-twin.ts";
import { measuredBox } from "./measured-box.ts";
import { adopted, elementsAtPlace, elementsWithSlot, iconPaths, passedClasses } from "./part-elements.ts";
import { placeholderOf, readPseudoElements } from "./pseudo-cascade.ts";
import { PseudoBoxCascade } from "./pseudo-elements.ts";

/** Why the kit draws none of an element between a box and its part. */
const BETWEEN_UNDRAWN = "an element between a box and its part, which the kit draws no layer for";

/**
 * Why a declaration of an element that generates no box, read by no layer and not inherited, sets
 * nothing: its parts lay out in its parent's box, and it has no box of its own to take the property
 * (CSS Display 3 §2.5).
 */
const NO_BOX_UNDRAWN =
  "the element generates no box (display: contents), so it has no box this property sets";

/** Why a box's spacing declarations stay unmapped where its children do not all win them alike. */
const UNEVEN_SPACING: CoverageNote = {
  outcome: "unmapped",
  detail:
    "not every child but the last wins the class's spacing alike, or the last child wins it too, which one item spacing cannot draw",
};

/**
 * An element's text nodes joined between its element children: the text before each child, then
 * the text after the last. The capture records them where `text` and `textIndex` lose some, and
 * otherwise the element's text sits before the child its `textIndex` names, or after the last.
 */
function textsOf(element: CapturedElement): readonly string[] {
  if (element.texts !== undefined) {
    return element.texts;
  }
  const texts = Array.from({ length: element.children.length + 1 }, () => "");
  texts[Math.min(element.textIndex ?? element.children.length, element.children.length)] = element.text;
  return texts;
}

/** Whether `element` is a descendant of `box`. */
function holdsElement(box: CapturedElement, element: CapturedElement): boolean {
  return box.children.some((child) => child === element || holdsElement(child, element));
}

/**
 * What a composite's root holds beyond its element's: the elements below it down to each root its
 * cell measures, by the root's `data-slot`, and its placement rule's declarations.
 */
type ComposedRoot = {
  readonly rooted: ReadonlyMap<string, readonly CapturedElement[]>;
  readonly applied: readonly Applied[];
};

/** A box that holds no other root. */
const PLAIN: ComposedRoot = { rooted: new Map(), applied: [] };

/**
 * Whether an element's own winning `visibility` shows it, or undefined where it wins none, or one,
 * such as `inherit`, that leaves the inherited value.
 */
function declaredVisibility(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[]
): boolean | undefined {
  const value = element.declarations
    .map((index) => declarations[index])
    .findLast((declaration) => declaration?.property === "visibility")?.value;
  const keyword = value === undefined ? undefined : normalizeCss(value);
  return keyword === "visible" ? true : keyword === "hidden" || keyword === "collapse" ? false : undefined;
}

/** The cascade of one box, read from its element in the capture. */
export class CaptureBoxCascade implements BoxCascade {
  readonly style: LayerStyle;
  readonly path: readonly string[];
  readonly #read: CellRead;
  readonly #ledger: CellLedger;
  readonly #placed: readonly Placed[];
  readonly #layer: Layer;
  readonly #rooted: ReadonlyMap<string, readonly CapturedElement[]>;
  /** How many element children the box's element holds in the capture. */
  readonly elementChildren: number | undefined;
  /** Where the box's element sits in the capture, and its `data-slot`. */
  readonly drawnAt: DrawnAt | undefined;
  /** How many elements lie above the box's element in the capture, from `<html>` down. */
  readonly depth: number | undefined;
  /** The tag of the box's element in the capture. */
  readonly elementTag: string | undefined;
  /** The text the box's element holds as its own in the capture. */
  readonly elementText: string | undefined;
  /** Whether the box's element sets its `::marker` a `content` beyond `normal` or `none`. */
  readonly markerContent: boolean | undefined;
  /** What the capture measured of the box's element. */
  readonly measured: MeasuredBox | undefined;
  /** The content height around a root whose height is a percentage, as `percentHeightBasis` in `components/percent-height.ts` reads it. */
  heightBasis: PreviewLength | undefined = undefined;
  /** Whether the flex rows around a root of `auto` height stretch it to its host's height, as `stretchedToHost` in `components/percent-height.ts` reads it. */
  stretchedToHost = false;
  /** The slots of an anchored composite's roots in drawn order, as `anchoredPlacement` in `anchored-placement.ts` orders them. */
  drawnSlots: readonly (string | undefined)[] | undefined = undefined;
  /** The box's pseudo-elements the mapping draws as layers, as `readPseudoElements` keeps them. */
  readonly pseudoElements: readonly PseudoCascade[];

  /**
   * @param read - The cell's declarations.
   * @param ledger - The ledger of the scope the box cascades in.
   * @param placed - The elements from `<html>` down to the box's, with their layer names.
   * @param parent - The layer of the element above the box.
   * @param path - The keys of the layers from the root down to the box's.
   * @param composed - What a composite's root holds beyond its element's.
   * @param undrawn - Why the box's own declarations that no layer reads set nothing, for an element
   *   that generates no box, or undefined.
   */
  constructor(
    read: CellRead,
    ledger: CellLedger,
    placed: readonly Placed[],
    parent: Layer | undefined,
    path: readonly string[],
    composed: ComposedRoot = PLAIN,
    undrawn?: string
  ) {
    this.#read = read;
    this.#ledger = ledger;
    this.#placed = placed;
    this.#rooted = composed.rooted;
    const own = placed.at(-1);
    if (own !== undefined) {
      read.drawn.set(own.element, own.name);
    }
    this.#layer = ledger.add(
      parent === undefined ? new Map() : inheritance(parent, read.context),
      [
        ...appliedOf(read, ownDeclarations(read, placed), placed, () => true),
        ...placeholderOf(read, ledger, placed),
        ...composed.applied,
      ],
      parent,
      undrawn === undefined ? undefined : { undrawn }
    );
    this.style = new LayerStyle(ledger, this.#layer, path);
    this.path = path;
    this.pseudoElements = readPseudoElements(read, ledger, placed, this.#layer, path).map(
      ({ pseudo, style }) => ({ pseudo, cascade: new PseudoBoxCascade(style, ledger.scope.inPlace) })
    );
    this.elementChildren = own?.element.children.length;
    const place = own === undefined ? undefined : read.places.get(own.element);
    this.drawnAt =
      own === undefined || place === undefined
        ? undefined
        : { place, slot: own.element.attributes["data-slot"] };
    this.depth = own === undefined ? undefined : placed.length - 1;
    this.elementTag = own?.element.tag;
    this.elementText = own?.element.text;
    // The capture records a `::marker` only where it sets such a `content`.
    this.markerContent = own === undefined ? undefined : own.element.pseudo.marker !== undefined;
    // The parent the capture measured is the box's frame only where the kit draws that element.
    const above = placed.at(-2)?.element;
    this.measured =
      own === undefined
        ? undefined
        : measuredBox(own.element, read.declarations, above !== undefined && read.drawn.has(above));
  }

  spaceChildren(children: number | undefined, spacing?: ChildSpacing): NumberSpec | undefined {
    const own = this.#placed.at(-1);
    const byChild = spacingByChild(this.#read, own?.element);
    const indexes = [...new Set(byChild.flatMap((held) => [...held]))];
    const withheld = indexes.flatMap((index) => {
      const declaration = this.#read.declarations[index];
      return declaration === undefined ? [] : [{ ...declaration, index }];
    });
    if (own === undefined || withheld.length === 0) {
      return undefined;
    }
    // One item spacing draws the class only where every child but the last wins all of it and the
    // last child none, as CSS gives it where nothing on a child outranks it.
    const even =
      byChild.at(-1)?.size === 0 &&
      byChild.slice(0, -1).every((held) => indexes.every((index) => held.has(index)));
    const spaced =
      even && children !== undefined && children > 1
        ? spacing?.(withheld.map(({ property, value }) => ({ property, value })))
        : undefined;
    const note = even ? childSpacingNote(children) : UNEVEN_SPACING;
    // The box's row of a class accounts for each child's declaration of it, and each child's
    // declaration belongs to the set that owns it there, so one class can give rows to two sets.
    for (const declaration of withheld) {
      const { className, property, value, index } = declaration;
      const byOrigin = new Map<Origin, CapturedAt[]>();
      own.element.children.forEach((child, at) => {
        if (byChild[at]?.has(index) !== true) {
          return;
        }
        const origin = declarationOrigin(own, this.#read.claims.get(child) ?? [], "", declaration);
        const each = atOf(this.#read, child, index);
        byOrigin.set(origin, [...(byOrigin.get(origin) ?? []), ...(each === undefined ? [] : [each])]);
      });
      for (const [origin, at] of byOrigin) {
        routed(
          this.#layer.inPlace,
          origin
        )({
          part: own.name,
          className,
          property,
          value,
          ...(spaced?.notes.get(property) ?? note),
          at,
        });
      }
    }
    return spaced?.itemSpacing;
  }

  inPlace(): InPlace | undefined {
    return this.#ledger.scope.inPlace;
  }

  part(part: string, element: PartElement): BoxCascade {
    const box = this.#placed.at(-1)?.element;
    const found =
      box === undefined
        ? undefined
        : element.slot !== undefined
          ? (this.#rooted.get(element.slot) ?? elementsWithSlot(box, element.slot, this.#claimed))
          : element.place === undefined
            ? undefined
            : elementsAtPlace(this.#placed, element.place);
    // An optional part the composite turns off is not in its markup; the inner set's own capture of
    // the same cell holds it, as the instance draws it hidden.
    const own = box === undefined || element.optional !== true ? undefined : this.#read.innerOwn.get(box);
    const borrowed =
      (found === undefined || found.length === 0) && own !== undefined && element.slot !== undefined
        ? elementsWithSlot(own.root, element.slot, new Set())?.map((each) =>
            adopted(this.#read, each, own.capture)
          )
        : undefined;
    const elements = borrowed ?? found;
    if (borrowed === undefined && found?.[0] !== undefined) {
      this.#checkTextSide(found[0], `the part ${part}`, element.after === "label" ? "after" : "before");
    }
    if (elements === undefined || elements.length === 0) {
      throw new KitUnmappable({
        message: `the capture holds no element for the part ${part} below ${this.#placed.at(-1)?.name ?? "the root"}, ${element.slot === undefined ? `at the place ${element.place ?? "the manifest leaves unnamed"}` : `with data-slot ${element.slot}`}`,
      });
    }
    // An element that generates no box hands its parts to this box, so its own path is this box's.
    const noBox = elements.at(-1)?.measured?.noBox === true;
    return this.#below(elements, part, this.#ledger, noBox ? this.path : [...this.path, element.key], {
      undrawn: noBox ? NO_BOX_UNDRAWN : undefined,
    });
  }

  instance(
    part: string,
    element: { readonly slot: string | undefined; readonly set: string; readonly after?: "label" },
    scope: InstanceScope
  ): BoxCascade {
    const box = this.#placed.at(-1)?.element;
    const found =
      box === undefined || element.slot === undefined
        ? undefined
        : (this.#rooted.get(element.slot) ?? elementsWithSlot(box, element.slot, this.#claimed));
    const root = found?.at(-1);
    if (found?.[0] !== undefined && this.#rooted.size === 0) {
      this.#checkTextSide(
        found[0],
        `the instance part ${part}`,
        element.after === "label" ? "after" : "before"
      );
    }
    if (found === undefined || root === undefined) {
      throw new KitUnmappable({
        message: `the capture holds no inner root ${element.slot ?? "without a data-slot"} for the instance part ${part}`,
      });
    }
    const { passed, own, capture, cell } = passedClasses(this.#read, root, element.set, scope.cell, part);
    const place = this.#read.places.get(root);
    if (place !== undefined) {
      this.#read.instances.push({ place, set: element.set, cell });
    }
    // An instance part's root enters the cell's claims once, however often its cascade runs, and
    // each visit passes its own holder down its path.
    if (!this.#read.inner.has(root)) {
      for (const [below, claimed] of twinClaims(root, own, {
        inner: capture.declarations,
        composite: this.#read.declarations,
      })) {
        this.#read.claims.set(below, [claimed, ...(this.#read.claims.get(below) ?? [])]);
      }
    }
    this.#read.inner.set(root, passed);
    this.#read.innerOwn.set(root, { root: own, capture });
    const inner: CellScope = {
      cell: scope.cell,
      context: this.#ledger.scope.context,
      origin: scope.inPlace.inner,
      record: scope.inPlace.inner.record,
      inPlace: scope.inPlace,
    };
    return this.#below(found, part, this.#ledger.withScope(inner), [], { holder: scope.passed.origin });
  }

  /** Cascade the elements down to a part's, the last of `elements`, below this box. */
  #below(
    elements: readonly CapturedElement[],
    part: string,
    ledger: CellLedger,
    path: readonly string[],
    {
      undrawn,
      holder,
    }: {
      readonly undrawn?: string | undefined;
      /** The origin of the set that holds the instance part whose inner root is the part's element. */
      readonly holder?: Origin;
    } = {}
  ): BoxCascade {
    const { context } = this.#read;
    const { origin } = this.#ledger.scope;
    let parent = this.#layer;
    const placed = [...this.#placed];
    for (const between of elements.slice(0, -1)) {
      placed.push(placedBelow(placed, between, undrawnName(between), origin));
      parent = this.#ledger.add(
        inheritance(parent, context),
        appliedOf(this.#read, between.declarations, placed, ({ property }) =>
          inheritsProperty(property, context)
        ),
        parent,
        { undrawn: BETWEEN_UNDRAWN }
      );
    }
    const target = elements.at(-1);
    if (target !== undefined) {
      this.#claimed.add(target);
      placed.push(placedBelow(placed, target, part, ledger.scope.origin, holder));
    }
    // A composite's root that sits below this part, as a nested popup sits in the column beside its
    // parent popup, keeps the chain of the component's elements around it.
    const rooted = new Map(
      [...this.#rooted].filter(([, chain]) => {
        const root = chain.at(-1);
        return target !== undefined && root !== undefined && root !== target && holdsElement(target, root);
      })
    );
    const composed = rooted.size === 0 ? PLAIN : { rooted, applied: [] };
    return new CaptureBoxCascade(this.#read, ledger, placed, parent, path, composed, undrawn);
  }

  /**
   * Cascade the element the box holds its label's text in, as a Sidebar row holds its label in a
   * `<span>`, where a rule of a class above the element reaches it, as `[&>span:last-child]:truncate`
   * does. The element is the box's child of the label's tag that holds a text node and no
   * `data-slot`, and the label is the box's last layer. Its path is the text layer's.
   *
   * @param element - Whether the label is the box's last layer, and the label's key.
   * @returns The element's style, or undefined where no rule of a class above it reaches it, so the
   *   label reads this box's style.
   */
  labelElement(element: {
    readonly last: boolean;
    readonly key: string;
  }): { readonly style: LayerStyle; readonly measured: MeasuredBox } | undefined {
    const box = this.#placed.at(-1);
    if (box === undefined || !element.last) {
      return undefined;
    }
    const held = box.element.children.find(
      (child) =>
        child.textIndex !== undefined &&
        child.attributes["data-slot"] === undefined &&
        !this.#claimed.has(child)
    );
    // A declaration's `owner` counts the steps up to the element whose class its rule names: 0 for
    // the element itself, so any higher count names the box or an element above it.
    if (
      held === undefined ||
      !held.declarations.some((index) => (this.#read.declarations[index]?.owner ?? 0) > 0)
    ) {
      return undefined;
    }
    // An element beside text of the box's own, as `Open. <a>Pay</a>` under `[&>a]:underline`, styles
    // only its own run of the label, which `textRuns` reads.
    if (this.#labelNodes(box.element).some((node) => node.within[0] !== held && node.text.trim() !== "")) {
      return undefined;
    }
    this.#claimed.add(held);
    const placed = [...this.#placed, placedBelow(this.#placed, held, undrawnName(held), box.origin)];
    const layer = this.#ledger.add(
      inheritance(this.#layer, this.#read.context),
      appliedOf(this.#read, held.declarations, placed, () => true),
      this.#layer
    );
    this.#labelHolder = { element: held, placed, layer };
    return {
      style: new LayerStyle(this.#ledger, layer, [...this.path, element.key]),
      measured: measuredBox(held, this.#read.declarations, false),
    };
  }

  capturedText(attribute: string | undefined): CapturedText {
    const element = this.#placed.at(-1)?.element;
    if (element === undefined) {
      return { _tag: "Unresolved", reason: "the capture holds no element for the label's box" };
    }
    const visible = this.#visible();
    if (attribute !== undefined) {
      const value = element.attributes[attribute];
      return value === undefined
        ? { _tag: "Unresolved", reason: `the element holds no \`${attribute}\` attribute` }
        : visible
          ? { _tag: "Painted", source: "attribute", text: value }
          : { _tag: "Hidden" };
    }
    const nodes = this.#labelNodes(element);
    return visible || nodes.length > 0
      ? { _tag: "Painted", source: "nodes", text: nodes.map((node) => node.text).join("") }
      : { _tag: "Hidden" };
  }

  textRuns(label: string): readonly TextRun[] | undefined {
    const box = this.#placed.at(-1);
    const nodes = box === undefined ? [] : this.#labelNodes(box.element);
    // An element below the box that sets a declaration of its own styles the text it holds. The
    // element the label is held in sets the label's own style.
    const holder = this.#labelHolder;
    const below = (within: readonly CapturedElement[]): readonly CapturedElement[] =>
      within.filter((element) => element !== holder?.element);
    const styled = nodes.some((node) =>
      below(node.within).some((element) =>
        element.declarations.some((index) => {
          const declaration = this.#read.declarations[index];
          return declaration !== undefined && !isBase(declaration);
        })
      )
    );
    // A link styles nothing of its own past the base layers, as a bare `<a>` under preflight, and
    // still gives its range a target. The innermost `<a>` between the box and the text links it, the
    // label's own element included.
    const targets = new Map(
      nodes.map((node) => [
        node,
        linkTarget(node.within.findLast((element) => element.tag === "a")?.attributes.href),
      ])
    );
    const linked = [...targets.values()].some((target) => target !== undefined);
    if (box === undefined || !(styled || linked)) {
      return undefined;
    }
    // Each element cascades once, over the element above it, in document order. The label's own
    // element has cascaded already, and its style is the label's, so no run lists it.
    const cascaded = new Map<
      CapturedElement,
      { readonly placed: readonly Placed[]; readonly layer: Layer; readonly style?: LayerStyle }
    >(holder === undefined ? [] : [[holder.element, holder]]);
    return nodes.map((node) => {
      const { text, within } = node;
      let placed: readonly Placed[] = this.#placed;
      let layer = this.#layer;
      const elements: LayerStyle[] = [];
      for (const held of within) {
        const known = cascaded.get(held);
        if (known !== undefined) {
          ({ placed, layer } = known);
          if (known.style !== undefined) {
            elements.push(known.style);
          }
          continue;
        }
        placed = [...placed, placedBelow(placed, held, undrawnName(held), box.origin)];
        layer = this.#ledger.add(
          inheritance(layer, this.#read.context),
          appliedOf(this.#read, held.declarations, placed, () => true),
          layer
        );
        const style = new LayerStyle(this.#ledger, layer, [...this.path, label]);
        cascaded.set(held, { placed, layer, style });
        elements.push(style);
      }
      return { text, elements, hyperlink: targets.get(node) };
    });
  }

  /** Whether the box's element is visible, as its resolved `visibility` says. */
  #visible(): boolean {
    return normalizeCss(this.style.resolved("visibility") ?? "visible") === "visible";
  }

  /**
   * The text nodes that paint the box's label, in document order: the element's own and those of the
   * elements below it that no layer draws, each where its element is visible, with the elements
   * between the box and the node, outermost first. An element a layer draws holds a part's text, not
   * the label's. The one text {@link BoxCascade.capturedText} reads and the runs
   * {@link BoxCascade.textRuns} reads both come from this walk, so they agree on every node.
   *
   * @param element - The box's element.
   * @returns The painted nodes, each with its text, which is never empty.
   */
  #labelNodes(
    element: CapturedElement
  ): readonly { readonly text: string; readonly within: readonly CapturedElement[] }[] {
    const nodes: { readonly text: string; readonly within: readonly CapturedElement[] }[] = [];
    const walk = (at: CapturedElement, shown: boolean, within: readonly CapturedElement[]): void => {
      const own = (text: string): void => {
        if (shown && text !== "") {
          nodes.push({ text, within });
        }
      };
      const texts = textsOf(at);
      at.children.forEach((held, place) => {
        own(texts[place] ?? "");
        if (!this.#read.drawn.has(held)) {
          walk(held, declaredVisibility(held, this.#read.declarations) ?? shown, [...within, held]);
        }
      });
      own(texts[at.children.length] ?? "");
    };
    walk(element, this.#visible(), []);
    return nodes;
  }

  icon(slot: IconSlot): IconCascade {
    this.#icons ??= iconPaths(this.#placed.at(-1)?.element);
    // An icon is an `<svg>` the box holds itself, or one inside a wrapper, as a pending Button's
    // spinner sits in a span, and it marks its side with `data-icon` where the slot names one.
    const matches = (path: readonly CapturedElement[]): boolean =>
      (slot.direct ? path.length === 1 : path.length > 1) &&
      path[0]?.attributes["data-icon"] === slot.dataIcon;
    const at = this.#icons.findIndex(matches);
    // An optional icon the composite turns off is not in its markup; the inner set's own capture of
    // the same cell holds it, as the instance draws it hidden.
    const box = this.#placed.at(-1)?.element;
    const own = box === undefined ? undefined : this.#read.innerOwn.get(box);
    const [found] =
      at >= 0
        ? this.#icons.splice(at, 1)
        : slot.optional === undefined || own === undefined
          ? []
          : iconPaths(own.root)
              .filter(matches)
              .map((path) => path.map((each) => adopted(this.#read, each, own.capture)));
    if (found === undefined) {
      throw new KitUnmappable({
        message: `the capture holds no <svg> for the icon ${slot.name} of ${this.#placed.at(-1)?.name ?? "the root"}`,
      });
    }
    if (at >= 0) {
      this.#checkTextSide(found[0], `the icon ${slot.name}`, slot.side === "start" ? "before" : "after");
    }
    const style = this.#below(found, slot.name, this.#ledger, [...this.path, slot.key]).style;
    // The icon layer draws the `<svg>`'s own box, so the record names the `<svg>`'s place. A wrapper
    // around it draws no layer, and its box holds the `<svg>`'s margins too.
    const svg = found.at(-1);
    const place = svg === undefined ? undefined : this.#read.places.get(svg);
    const [held] = found;
    // The capture records a `::before` or `::after` only where it renders a box (`run-capture.ts`).
    const beside =
      at < 0 || box === undefined || held === undefined
        ? undefined
        : {
            later: box.children.slice(box.children.indexOf(held) + 1).map(({ tag }) => tag),
            generated: (["before", "after"] as const).filter((pseudo) => box.pseudo[pseudo] !== undefined),
          };
    return {
      style,
      drawnAt: place === undefined ? undefined : { place, slot: svg?.attributes["data-slot"] },
      beside,
    };
  }

  /**
   * Check that a child of the box draws on the side of the box's own text its definition names: an
   * icon on its `side`, a part after the text where it is `after: "label"` and before it otherwise,
   * by its place in the markup and its `order`. A box without text of its own, and a child out of
   * the flow, have no side to check.
   *
   * @throws `KitUnmappable` where the captured markup puts the child on the other side.
   */
  #checkTextSide(child: CapturedElement | undefined, what: string, side: "before" | "after"): void {
    const box = this.#placed.at(-1)?.element;
    const textIndex = box?.textIndex;
    const index = child === undefined || box === undefined ? -1 : box.children.indexOf(child);
    if (textIndex === undefined || index < 0) {
      return;
    }
    // A flex item's `order` moves it past the text, an anonymous item at order 0 (CSS Flexbox 1
    // §5.4), as a pending Button's `order-first` draws its spinner first.
    const winner = (longhand: string): string | undefined =>
      child?.declarations
        .map((each) => this.#read.declarations[each])
        .findLast((declaration) => declaration?.longhands.includes(longhand) === true)
        ?.value.trim();
    // An absolute or fixed child sits out of the flow, where its offsets place it.
    if (/^(absolute|fixed)$/.test(winner("position") ?? "")) {
      return;
    }
    const order = Number(winner("order") ?? "0");
    const before = order === 0 || Number.isNaN(order) ? index < textIndex : order < 0;
    if (before !== (side === "before")) {
      throw new KitUnmappable({
        message: `${what} of ${this.#placed.at(-1)?.name ?? "the root"} sits ${before ? "before" : "after"} the box's text in the capture, and its definition puts it ${side}`,
      });
    }
  }

  /** The elements the box's parts, instance parts and icons claimed so far. */
  readonly #claimed = new Set<CapturedElement>();

  /** The element the box holds its label's text in, as {@link labelElement} cascades it, if any. */
  #labelHolder:
    | { readonly element: CapturedElement; readonly placed: readonly Placed[]; readonly layer: Layer }
    | undefined;

  /** The box's icons not read yet, each as the elements from below the box down to its `<svg>`. */
  #icons: CapturedElement[][] | undefined;
}
