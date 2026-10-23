/**
 * Every definition the kit builds has a renderer, and each cell its preview frames place renders
 * one root part for the page to measure: the page measures, forces and crops the one element in
 * the slot whose `data-slot` is the definition's `slot`, or the one its `element` selects where the
 * root carries no `data-slot`, at any depth, so none or two would compare the wrong box. A radio
 * renders inside its `RadioGroup`, so its root is not at the top.
 *
 * Unit under test: each kit definition's attribute conditions, the cells where its state table
 * holds each variant of `ATTRIBUTE_VARIANTS`, the parts each cell shows, the icon slots the
 * root and each part the cell renders list in `iconsFor`, and the label text each box draws.
 * Oracle: the static markup the real Fuse component renders for every preview cell, through the
 * definition's compare renderer. A condition must hold in a cell exactly when the measured
 * element carries the attribute its variant selects, or the part the definition's `statePart` names
 * where a part takes the set's states, and a condition the root's or a part's own classes name must
 * hold exactly when that element carries it. A group variant must hold exactly where an element
 * above each element that names it is the group in that state, or, where no element below the root
 * names it, the root or an element around it, a parent-context variant such as
 * `item-described:` exactly where the root holds what it reads for the parts below it, and a tag
 * variant such as `[a]:` exactly where the root is that element. The parts must match the measured
 * element's descendants that carry a part's `data-slot` or that its `element` selects, each below
 * its parent part, and any other part with no `data-slot` must be the one child element of its
 * parent part beside those parts and Base UI's hidden span. The slots must match the measured
 * element's `<svg>` descendants in order, each under the part that lists it, its nearest ancestor
 * among the root and the parts, as a child of that part or nested deeper, and with its `data-icon`.
 * A slot that names classes of its own must name the `<svg>`'s `class` attribute exactly. The root
 * and each part must hold their label's characters where the cell shows the label, as their own
 * text, after a space where the label says the markup holds one, or in the attribute the label
 * names, as an `<input>` holds its placeholder, or as the own text of the one bare child element
 * its `textElement` names, as Pagination's edge holds its copy, and no text where it does not, so
 * the compare page renders the text Figma draws. A box that shows an image must be an `<img>` whose `src` is a data
 * URI of the image's bytes, and a box that shows none carries no `src`, so the page draws the
 * picture Figma draws. A part's `style` attribute must hold exactly the declarations its
 * definition cascades above its classes, so a meter's fill is as wide in Figma as Base UI makes
 * it. The elements around the measured element must carry each ancestor its definition names,
 * outermost first, with its `data-slot` and exactly its classes, and no other element with a
 * `data-slot` may sit between the outermost of them and the root, so the page draws the root in the
 * type and color the build passes down. The pseudo-class variants, `enabled-hover:`, `hover:` and `focus-visible:`, stay out, since
 * static markup cannot show them, and so does the icon edge, which the slots check. On a React Aria
 * element marked `data-rac`, `hover:` and `enabled-hover:` read `data-hovered`, which React Aria
 * stamps only while a hydrated page is hovered, so the renderer names it in its forced attributes,
 * which the page writes on the measured element when it forces the cell's state. There both must
 * hold exactly where those attributes carry `data-hovered`.
 *
 * `test/markup-check.ts` holds the assertions, `test/markup-tree.ts` the queries over the markup and
 * `test/markup-variants.ts` the variant tables. This suite runs them on every kit definition and on
 * hand-written fixtures.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { chip, ICON } from "../../test/fixture-sets";
import { checkMarkup, expectedLabel } from "../../test/markup-check";
import { markupLabel } from "../../test/markup-tree";
import {
  ATTRIBUTE_VARIANTS,
  GROUP_VARIANTS,
  NOT_ATTRIBUTES,
  PARENT_VARIANTS,
  TAG_VARIANTS,
} from "../../test/markup-variants";
import { elementsOf } from "../../test/static-markup";
import { splitClassName } from "../components/class-name";
import { definitionClasses } from "../components/component-spec";
import type {
  AncestorDefinition,
  BoxDefinition,
  ComponentDefinition,
  IconSlot,
  PartDefinition,
} from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import { makeStateTable } from "../components/state-table";
import { loadRenderers } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";

describe("each kit definition against the markup of its component", () => {
  it.each(KIT.map(({ definition }) => [definition.name, definition] as const))(
    "%s lists every attribute variant its facts, states and recipe conditions name",
    (_name, definition) => {
      const meaningOf = makeStateTable(definition);
      const recipeConditions = definitionClasses(definition)
        .flatMap((className) => splitClassName(className).variants)
        .filter((variant) => meaningOf(variant).kind === "condition");
      const named = new Set([
        ...definition.facts.keys(),
        ...Object.values(definition.states).flat(),
        ...recipeConditions,
      ]);
      const listed = [NOT_ATTRIBUTES, ATTRIBUTE_VARIANTS, GROUP_VARIANTS, PARENT_VARIANTS, TAG_VARIANTS];
      const unlisted = [...named].filter((variant) => !listed.some((list) => list.has(variant)));
      expect(unlisted).toEqual([]);
    }
  );

  it("renders one measured element per cell, holds each attribute condition exactly where it carries it, and places its parts, icons and label", async () => {
    const renderers = await loadRenderers();
    const checked = KIT.flatMap((entry) => {
      const renderer = renderers.get(entry.definition.key);
      return renderer === undefined ? [] : [{ ...entry, renderer }];
    });
    // No KIT key lacks a renderer.
    expect(checked.map(({ definition }) => definition.key)).toEqual(
      KIT.map(({ definition }) => definition.key)
    );
    for (const { definition, previewCells, renderer } of checked) {
      checkMarkup(definition, previewCells, renderer);
    }
  });
});

// Unit under test: `checkMarkup` on a definition whose root and part name their elements, since the
// markup carries no `data-slot` there, as React Aria's Link renders an `<a data-rac>`. Oracle: the
// hand-written markup below, where exactly one `<a>` carries `data-rac` and `role="link"`, its one
// `aria-hidden` span is the part, and the `<svg>` child and the text `Chip` are the root's own. A
// second span sits beside the part, so the part cannot be found by its place.
describe("the markup check of a root without a data-slot", () => {
  const DOT: PartDefinition = {
    key: "dot",
    slot: undefined,
    element: { tag: "span", attributes: { "aria-hidden": "true" } },
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => [],
  };
  const LINK = chip("", {
    element: { tag: "a", attributes: { "data-rac": true, role: "link" } },
    label: { key: "label", name: "label", characters: "Chip", textProperty: undefined, shownIn: () => true },
    iconsFor: () => [ICON],
    parts: [DOT],
  });
  const markup: CellRendering = {
    element: () =>
      createElement(
        "div",
        null,
        createElement(
          "a",
          { "data-rac": "", role: "link", href: "#" },
          createElement("span", { "aria-hidden": "true" }),
          createElement("span", { className: "sr-only" }, "opens a page"),
          createElement("svg"),
          "Chip"
        )
      ),
  };
  const CELLS = [{ state: "rest" }];

  it("places the root, its part and its icon by the elements they name", () => {
    expect(() => checkMarkup(LINK, CELLS, markup)).not.toThrow();
  });

  it("fails a root whose selector names an attribute value the markup does not hold", () => {
    const button: ComponentDefinition = {
      ...LINK,
      element: { tag: "a", attributes: { "data-rac": true, role: "button" } },
    };
    expect(() => checkMarkup(button, CELLS, markup)).toThrow("the chip parts");
  });
});

// Unit under test: `checkMarkup` on a React Aria root with a hover state. Oracle: React Aria stamps
// `data-hovered` on an element marked `data-rac` only while a hydrated page hovers it, which
// `hover:` reads there, so the renderer's forced attributes must carry it exactly in the cells where
// the state table holds `hover:`. The hand-written renderer stamps it on the hover cell where it
// passes, and nowhere where it fails.
describe("the markup check of a React Aria root's hover", () => {
  const DAY = chip("hover:bg-muted", {
    element: { tag: "div", attributes: { "data-rac": true } },
    axes: [{ name: "state", values: ["rest", "hover"] }],
  });
  const CELLS = [{ state: "rest" }, { state: "hover" }];
  const element = () => createElement("div", { "data-rac": "" });

  it("passes a renderer that names data-hovered for the hover cell", () => {
    const stamped: CellRendering = {
      element,
      forcedAttributes: (cell) => (cell.state === "hover" ? { "data-hovered": "true" } : {}),
    };
    expect(() => checkMarkup(DAY, CELLS, stamped)).not.toThrow();
  });

  it("fails a renderer that leaves the hover cell as static markup has it", () => {
    expect(() => checkMarkup(DAY, CELLS, { element })).toThrow("chip/state=hover: hover");
  });
});

/** A part with a `data-slot`, shown in every cell, holding the given parts. */
function slotted(slot: string, parts: readonly PartDefinition[]): PartDefinition {
  return {
    key: slot,
    slot,
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => [],
    parts,
  };
}

/** A part with no `data-slot`, shown in every cell, that names its element as an `aria-hidden` span. */
function hiddenSpan(key: string, icons: readonly IconSlot[] = []): PartDefinition {
  return {
    key,
    slot: undefined,
    element: { tag: "span", attributes: { "aria-hidden": "true" } },
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => icons,
  };
}

/** Markup for a chip cell: a `data-slot="chip"` span around the given children. */
function chipMarkup(...children: readonly ReactElement[]): CellRendering {
  return { element: () => createElement("span", { "data-slot": "chip" }, ...children) };
}

/** The `aria-hidden` span `hiddenSpan` selects, around the given children. */
const hidden = (...children: readonly ReactElement[]): ReactElement =>
  createElement("span", { "aria-hidden": "true" }, ...children);

// Unit under test: `checkMarkup` on parts that name their elements below two slotted parents. Oracle:
// the README's rule that such a part matches the element its selector matches below its parent part,
// so the selector of the left parent's `leading` part says nothing about the right parent's span. The
// hand-written markup holds one `aria-hidden` span in each parent where it passes, and both in the
// left parent where it fails.
describe("the markup check of parts that share a selector under two parents", () => {
  const TWO_PARENTS = chip("", {
    parts: [slotted("chip-left", [hiddenSpan("leading")]), slotted("chip-right", [hiddenSpan("trailing")])],
  });
  const left = (...children: readonly ReactElement[]) =>
    createElement("span", { "data-slot": "chip-left" }, ...children);
  const right = (...children: readonly ReactElement[]) =>
    createElement("span", { "data-slot": "chip-right" }, ...children);
  const CELLS = [{ state: "rest" }];

  it("finds each span as the part its own parent names", () => {
    expect(() => checkMarkup(TWO_PARENTS, CELLS, chipMarkup(left(hidden()), right(hidden())))).not.toThrow();
  });

  it("fails markup that moves the right parent's span into the left parent", () => {
    expect(() => checkMarkup(TWO_PARENTS, CELLS, chipMarkup(left(hidden(), hidden()), right()))).toThrow(
      "chip/state=rest: parts"
    );
  });

  // Oracle: the icon slot `iconsFor` lists on the left parent's `content` part, an `<svg>` that is a
  // direct child of that part's element. The right parent's part has the same key and lists none.
  describe("with an icon on one of two same-keyed parts", () => {
    const ONE_ICON = chip("", {
      parts: [
        slotted("chip-left", [hiddenSpan("content", [ICON])]),
        slotted("chip-right", [hiddenSpan("content")]),
      ],
    });

    it("passes the icon in the part that lists it", () => {
      const markup = chipMarkup(left(hidden(createElement("svg"))), right(hidden()));
      expect(() => checkMarkup(ONE_ICON, CELLS, markup)).not.toThrow();
    });

    it("fails the icon moved to the other parent's part of that key", () => {
      const markup = chipMarkup(left(hidden()), right(hidden(createElement("svg"))));
      expect(() => checkMarkup(ONE_ICON, CELLS, markup)).toThrow("chip/state=rest: icons");
    });
  });
});

// Unit under test: `checkMarkup` on a definition that names the elements around its root. Oracle: the
// rule on `ComponentDefinition.ancestorsFor`, that the cell sits in those elements, outermost first,
// each carrying its `data-slot` and exactly its classes. The hand-written markup holds a trail, a list
// and an item around the chip where it passes, an element the definition does not name outside them,
// and breaks one rule where it fails.
describe("the markup check of the elements around a root", () => {
  const LIST: AncestorDefinition = { slot: "chip-list", classes: "flex gap-1", undrawn: "the list" };
  const ITEM: AncestorDefinition = { slot: "chip-item", classes: "inline-flex", undrawn: "the item" };
  const CELLS = [{ state: "rest" }];
  const around = (list: string, ...items: readonly string[]): CellRendering => ({
    element: () =>
      createElement(
        "nav",
        { "data-slot": "chip-trail" },
        createElement(
          "ol",
          { "data-slot": "chip-list", className: list },
          items.reduceRight<ReactElement>(
            (inner, item) => createElement("li", { "data-slot": "chip-item", className: item }, inner),
            createElement("span", { "data-slot": "chip" })
          )
        )
      ),
  });

  it("passes a root inside each element its definition names, in order and with exactly their classes", () => {
    expect(() =>
      checkMarkup(chip("", { ancestorsFor: () => [LIST, ITEM] }), CELLS, around("flex gap-1", "inline-flex"))
    ).not.toThrow();
  });

  it.each([
    ["drops the item", [LIST, ITEM], around("flex gap-1")],
    ["gives the list other classes", [LIST, ITEM], around("flex gap-2", "inline-flex")],
    [
      "puts an item the definition does not name around the root",
      [LIST],
      around("flex gap-1", "inline-flex"),
    ],
    ["nests the item twice", [LIST, ITEM], around("flex gap-1", "inline-flex", "inline-flex")],
  ])("fails markup that %s", (_case, ancestors, markup) => {
    expect(() => checkMarkup(chip("", { ancestorsFor: () => ancestors }), CELLS, markup)).toThrow(
      "chip/state=rest: the ancestors"
    );
  });
});

// Unit under test: where the label check reads a box's label, through `textAttribute`. Oracle: the
// markup React writes for a `<textarea>`, which holds a placeholder in its `placeholder` attribute
// and a value as its own text, so one label reads an attribute in some cells and own text in others.
describe("the label check of a box that holds its text in an attribute in some cells", () => {
  // React writes the `&` as `&amp;` in the attribute and in the text, and the check reads the
  // characters a label holds.
  const TEXT = "Tell us more & then some";
  const TEXTAREA: BoxDefinition = {
    classesFor: () => "",
    iconsFor: () => [],
    label: {
      key: "text",
      name: "text",
      characters: TEXT,
      textProperty: "Text",
      shownIn: () => true,
      textAttribute: (cell) => (cell.content === "placeholder" ? "placeholder" : undefined),
    },
  };
  const markup = (props: Readonly<Record<string, string>>) =>
    elementsOf(renderToStaticMarkup(createElement("textarea", props)))[0];
  const placeholder = expectedLabel(TEXTAREA, { content: "placeholder" });
  const value = expectedLabel(TEXTAREA, { content: "value" });

  it("reads a placeholder cell's attribute and a value cell's own text", () => {
    expect([placeholder, value]).toEqual([
      { text: "", attribute: ["placeholder", TEXT] },
      { text: TEXT, attribute: undefined },
    ]);
    expect(markupLabel(markup({ placeholder: TEXT }), placeholder)).toEqual(placeholder);
    expect(markupLabel(markup({ defaultValue: TEXT }), value)).toEqual(value);
  });

  it("fails a value cell whose markup holds the text as a placeholder", () => {
    expect(markupLabel(markup({ placeholder: TEXT }), value)).not.toEqual(value);
  });
});

// Unit under test: `checkMarkup` on a label its `textElement` places in a child element. Oracle: the
// rule on `LabelDefinition.textElement`, that the child holds the characters as its own text and
// carries no `class` or `style`, so it lays out as the text alone. The hand-written markup holds the
// icon and one bare `<span>` around `Chip` where it passes, and the same span with a class where it
// fails.
describe("the label check of a label held in a bare child element", () => {
  const WRAPPED = chip("", {
    label: {
      key: "label",
      name: "label",
      characters: "Chip",
      textProperty: undefined,
      shownIn: () => true,
      textElement: { tag: "span", attributes: {} },
    },
    iconsFor: () => [ICON],
  });
  const CELLS = [{ state: "rest" }];
  const wrapped = (props: Readonly<Record<string, string>>) =>
    chipMarkup(createElement("svg"), createElement("span", props, "Chip"));

  it("reads the label as the own text of the child it names", () => {
    expect(() => checkMarkup(WRAPPED, CELLS, wrapped({}))).not.toThrow();
  });

  it("fails a child that carries a class, which would lay it out by its own rules", () => {
    expect(() => checkMarkup(WRAPPED, CELLS, wrapped({ className: "font-bold" }))).toThrow(
      "chip/state=rest: the label"
    );
  });
});
