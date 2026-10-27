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
 * names it, the root or an element around it, a peer variant such as `peer-data-active/menu-button:`
 * exactly where a sibling before the root is the peer in that state, with the sibling a definition's
 * `statePeer` names there once, a parent-context variant such as
 * `item-described:` exactly where the root holds what it reads for the parts below it, and a tag
 * variant such as `[a]:` exactly where the root is that element. The parts must match the measured
 * element's descendants that carry a part's `data-slot` or that its `element` selects, each below
 * its parent part, and any other part with no `data-slot` must be the one child element of its
 * parent part beside those parts and Base UI's hidden span. Parts of one parent that name the same
 * elements take them in DOM order. An instance part must be the element its inner root's `data-slot`
 * or `element` names below its parent part, whose `class` holds the inner classes with the passed
 * ones merged by `cn` and whose text the inner label's characters, and the check, its variant checks
 * among them, reads nothing inside it. The slots must match the measured
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
 * Each cell renders with every BOOLEAN property at its default, as its preview shows it, so a part
 * behind a property that starts false must be absent there, and a definition with such a part
 * renders each cell once more with each such property on, where the part must be there.
 *
 * `test/markup-check.ts` holds the assertions, `test/markup-tree.ts` the queries over the markup and
 * `test/markup-variants.ts` the variant tables. This suite runs them on every kit definition and on
 * hand-written fixtures.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { chip, dot, ICON } from "../../test/fixture-sets";
import { checkMarkup, expectedLabel } from "../../test/markup-check";
import { markupLabel } from "../../test/markup-tree";
import {
  ATTRIBUTE_VARIANTS,
  NAMED_ATTRIBUTE_VARIANTS,
  GROUP_VARIANTS,
  HAS_VARIANTS,
  NOT_ATTRIBUTES,
  PARENT_VARIANTS,
  PEER_VARIANTS,
  TAG_VARIANTS,
} from "../../test/markup-variants";
import { elementsOf } from "../../test/static-markup";
import { splitClassName } from "../components/class-name";
import { definitionClasses } from "../components/component-spec";
import type {
  AncestorDefinition,
  BoxDefinition,
  Cell,
  ComponentDefinition,
  IconSlot,
  PartDefinition,
} from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import { makeStateTable } from "../components/state-table";
import { isClientRenderer, loadRenderers } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";

/**
 * The kit sets whose renderer mounts on the compare page, by key, written by hand so a new one is a
 * decision.
 */
const CHECKED_ON_THE_MOUNTED_PAGE: readonly string[] = [
  "menu-group-label",
  "select-item",
  "select-popup",
  "select-open",
  "popover-content",
  "popover-open",
  "dropdown-menu-item",
  "dropdown-menu-checkbox-item",
  "dropdown-menu-radio-item",
  "dropdown-menu-sub-trigger",
  "dropdown-menu-popup",
  "dropdown-menu-sub-content",
  "dropdown-menu-open",
  "combobox-item",
  "combobox-empty",
  "combobox-popup",
  "combobox-open",
  "command-item",
  "command-list",
  "navigation-menu-popup",
];

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
      const listed = [
        NOT_ATTRIBUTES,
        ATTRIBUTE_VARIANTS,
        NAMED_ATTRIBUTE_VARIANTS,
        GROUP_VARIANTS,
        HAS_VARIANTS,
        PEER_VARIANTS,
        PARENT_VARIANTS,
        TAG_VARIANTS,
      ];
      const unlisted = [...named].filter((variant) => !listed.some((list) => list.has(variant)));
      expect(unlisted).toEqual([]);
    }
  );

  it("renders one measured element per cell, holds each attribute condition exactly where it carries it, and places its parts, icons and label", async () => {
    const renderers = await Effect.runPromise(loadRenderers());
    // No KIT key lacks a renderer.
    expect(
      KIT.filter(({ definition }) => renderers.has(definition.key)).map(({ definition }) => definition.key)
    ).toEqual(KIT.map(({ definition }) => definition.key));
    // A client set's popup renders only once a page mounts it, so `figma:compare` checks its markup
    // on the mounted page, in the self-check and in every run. These are the sets it covers.
    expect(
      KIT.filter(({ definition }) => {
        const renderer = renderers.get(definition.key);
        return renderer !== undefined && isClientRenderer(renderer);
      }).map(({ definition }) => definition.key)
    ).toEqual(CHECKED_ON_THE_MOUNTED_PAGE);
    const checked = KIT.flatMap((entry) => {
      const renderer = renderers.get(entry.definition.key);
      return renderer === undefined || isClientRenderer(renderer) ? [] : [{ ...entry, renderer }];
    });
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

// Unit under test: `checkMarkup` on a definition that holds an instance part beside a frame part.
// Oracle: the rule that an instance part is found like a part, by its inner root's `data-slot` below
// its parent part, that its `class` holds the inner definition's classes for the inner cell with the
// classes the outer component passes merged after them by `cn`, and that it holds the characters the
// outer cell gives the inner label's TEXT property. The check stops there, since the inner set's own
// renderer test owns the markup inside it, so an icon and a `chip-dot` span inside the badge are no
// icon or part of the chip. The hand-written markup holds what the rule says where it passes.
describe("the markup check of an instance part", () => {
  const BADGE = chip("inline-flex px-2 bg-[rgb(255_0_0)]", {
    key: "badge",
    name: "Badge",
    slot: "badge",
    label: { key: "label", name: "label", characters: "Badge", textProperty: "Label", shownIn: () => true },
  });
  const HOLDER = chip("flex", {
    parts: [
      dot(""),
      {
        kind: "instance",
        key: "action",
        of: BADGE,
        cell: () => ({ state: "rest" }),
        classesFor: () => "px-4",
        properties: () => ({ text: { Label: "Undo" } }),
        shownIn: () => true,
      },
    ],
  });
  const CELLS = [{ state: "rest" }];
  const markup = (className: string, text: string): CellRendering =>
    chipMarkup(
      createElement("span", { "data-slot": "chip-dot" }),
      createElement(
        "span",
        { "data-slot": "badge", className },
        createElement("svg"),
        createElement("span", { "data-slot": "chip-dot" }),
        text
      )
    );

  it("finds the inner root by its data-slot and reads its merged class and label, and nothing inside it", () => {
    expect(() =>
      checkMarkup(HOLDER, CELLS, markup("px-4 inline-flex bg-[rgb(255_0_0)]", "Undo"))
    ).not.toThrow();
  });

  it("fails an inner root that keeps the padding the outer component's class replaces", () => {
    expect(() =>
      checkMarkup(HOLDER, CELLS, markup("inline-flex px-2 bg-[rgb(255_0_0)] px-4", "Undo"))
    ).toThrow("chip/state=rest: the instance on /(action): the class");
  });

  it("fails an inner root that holds the label's default where the outer cell gives another", () => {
    expect(() => checkMarkup(HOLDER, CELLS, markup("inline-flex bg-[rgb(255_0_0)] px-4", "Badge"))).toThrow(
      "chip/state=rest: the instance on /(action): the label"
    );
  });

  it("fails a cell that renders no inner root", () => {
    const without: CellRendering = chipMarkup(createElement("span", { "data-slot": "chip-dot" }));
    expect(() => checkMarkup(HOLDER, CELLS, without)).toThrow("chip/state=rest: parts");
  });

  // Oracle: a Kbd group's markup, two sibling caps with one `data-slot`, which the definition names
  // as two instance parts by their keys, matched to the caps in DOM order.
  describe("of one component twice beside each other", () => {
    const cap = (key: string, text: string) => ({
      kind: "instance" as const,
      key,
      of: BADGE,
      cell: () => ({ state: "rest" }),
      properties: () => ({ text: { Label: text } }),
      shownIn: () => true,
    });
    const GROUP = chip("flex", { parts: [cap("ctrl", "Ctrl"), cap("k", "K")] });
    const caps = (...texts: readonly string[]): CellRendering =>
      chipMarkup(
        ...texts.map((text) =>
          createElement(
            "span",
            { "data-slot": "badge", className: "inline-flex px-2 bg-[rgb(255_0_0)]" },
            text
          )
        )
      );

    it("finds each part in DOM order and reads its own label", () => {
      expect(() => checkMarkup(GROUP, CELLS, caps("Ctrl", "K"))).not.toThrow();
    });

    it("fails the caps in the other order", () => {
      expect(() => checkMarkup(GROUP, CELLS, caps("K", "Ctrl"))).toThrow(
        "chip/state=rest: the instance on /(ctrl): the label"
      );
    });

    it("fails a cell that renders one of them", () => {
      expect(() => checkMarkup(GROUP, CELLS, caps("Ctrl"))).toThrow("chip/state=rest: parts");
    });

    it("fails a cell that renders a third", () => {
      expect(() => checkMarkup(GROUP, CELLS, caps("Ctrl", "K", "K"))).toThrow("chip/state=rest: parts");
    });
  });

  // Oracle: a Breadcrumb trail's markup, sibling `<li>` items with one `data-slot`, each around one
  // instance, which the definition names as frame parts by their keys, matched to the items in DOM
  // order as the caps above are.
  describe("in frame parts that share a data-slot beside each other", () => {
    const item = (key: string, text: string) => ({
      key,
      slot: "chip-item",
      shownIn: () => true,
      classesFor: () => "",
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          kind: "instance" as const,
          key: `${key}-badge`,
          of: BADGE,
          cell: () => ({ state: "rest" }),
          properties: () => ({ text: { Label: text } }),
          shownIn: () => true,
        },
      ],
    });
    const TRAIL = chip("flex", { parts: [item("first", "Home"), item("second", "Docs")] });
    const items = (...texts: readonly string[]): CellRendering =>
      chipMarkup(
        ...texts.map((text) =>
          createElement(
            "li",
            { "data-slot": "chip-item" },
            createElement(
              "span",
              { "data-slot": "badge", className: "inline-flex px-2 bg-[rgb(255_0_0)]" },
              text
            )
          )
        )
      );

    it("finds each item in DOM order and the instance inside it", () => {
      expect(() => checkMarkup(TRAIL, CELLS, items("Home", "Docs"))).not.toThrow();
    });

    it("fails the items in the other order", () => {
      expect(() => checkMarkup(TRAIL, CELLS, items("Docs", "Home"))).toThrow(
        "chip/state=rest: the instance on /chip-item(first)/(first-badge): the label"
      );
    });

    it.each([
      ["one of them", ["Home"]],
      ["a third", ["Home", "Docs", "Docs"]],
    ])("fails a cell that renders %s", (_case, texts) => {
      expect(() => checkMarkup(TRAIL, CELLS, items(...texts))).toThrow("chip/state=rest: parts");
    });
  });

  // A Select trigger as an instance shows it: Base UI stamps `data-popup-open` on the trigger while
  // its popup is open, which the trigger's `open=on` holds, and its caret reads that through
  // `group-data-[popup-open]/select-trigger:`.
  const TRIGGER = chip("group/select-trigger inline-flex", {
    key: "select-trigger",
    name: "Select trigger",
    slot: "select-trigger",
    axes: [{ name: "open", values: ["off", "on"] }],
    columnAxis: "open",
    facts: new Map([["data-popup-open", (cell: Cell) => cell.open === "on"]]),
  });
  const OPEN_TRIGGER = chip("flex", {
    parts: [
      {
        kind: "instance",
        key: "trigger",
        of: TRIGGER,
        cell: () => ({ open: "on" }),
        shownIn: () => true,
      },
    ],
  });
  const trigger = (attributes: Readonly<Record<string, string>>): CellRendering =>
    chipMarkup(
      createElement(
        "span",
        { "data-slot": "select-trigger", className: "group/select-trigger inline-flex", ...attributes },
        createElement("svg", { className: "group-data-[popup-open]/select-trigger:rotate-180" })
      )
    );

  // Oracle: the rule that the inner set's own renderer test owns the markup inside an instance, so a
  // resting composite holding an open Select trigger, whose caret reads the trigger's
  // `group-data-[popup-open]/select-trigger:`, holds no condition of the composite's state table.
  it("leaves the variants an element inside the instance names to the inner set", () => {
    expect(() => checkMarkup(OPEN_TRIGGER, CELLS, trigger({ "data-popup-open": "" }))).not.toThrow();
  });

  // Oracle: Base UI's trigger, which carries `data-popup-open` only while its popup is open, so a
  // composite that names the open trigger and renders a closed one draws another variant than its
  // markup holds.
  it("fails an instance root whose state attributes differ from the inner cell the part names", () => {
    expect(() => checkMarkup(OPEN_TRIGGER, CELLS, trigger({}))).toThrow(
      "chip/state=rest: the instance on /(trigger): data-popup-open"
    );
  });

  // Oracle: Tailwind compiles `group-data-[popup-open]/select-trigger:` to
  // `:where(.group\/select-trigger)[data-popup-open] *`, which holds below the trigger only while it is
  // open. This trigger declares only that fact, so a closed render fails on the fact alone.
  it("fails an instance root that does not show a group fact its inner cell declares", () => {
    const grouped = chip("flex", {
      parts: [
        {
          kind: "instance",
          key: "trigger",
          of: {
            ...TRIGGER,
            facts: new Map([["group-data-[popup-open]/select-trigger", (cell: Cell) => cell.open === "on"]]),
          },
          cell: () => ({ open: "on" }),
          shownIn: () => true,
        },
      ],
    });
    expect(() => checkMarkup(grouped, CELLS, trigger({}))).toThrow(
      "chip/state=rest: the instance on /(trigger): group-data-[popup-open]/select-trigger"
    );
  });
});

// Unit under test: `checkMarkup` on a box whose definition counts the element children the kit draws
// no layer for, which a class that spaces every child but the last reads. Oracle: the markup of
// Breadcrumb's ellipsis, an icon and the visually hidden `<span>` that holds its copy, so the box
// holds two element children where the definition draws one icon and counts one more.
describe("the markup check of a box that counts its element children", () => {
  const COUNTED = chip("", { iconsFor: () => [ICON], undrawnChildren: () => 1 });
  const CELLS = [{ state: "rest" }];
  const hiddenCopy = createElement("span", { className: "sr-only" }, "More");

  it("passes the icon beside the hidden copy", () => {
    expect(() => checkMarkup(COUNTED, CELLS, chipMarkup(createElement("svg"), hiddenCopy))).not.toThrow();
  });

  it.each([
    ["without the hidden copy", chipMarkup(createElement("svg"))],
    ["with a second hidden element", chipMarkup(createElement("svg"), hiddenCopy, hiddenCopy)],
  ])("fails the box %s", (_case, markup) => {
    expect(() => checkMarkup(COUNTED, CELLS, markup)).toThrow(
      "chip/state=rest: the element children of the root"
    );
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

// Unit under test: `checkMarkup` on a part behind a BOOLEAN property that starts false, as Alert's
// actions are. Oracle: what Figma draws, where a property that starts false hides the part in every
// variant and the previews show each property at its default (PQ), while a designer who turns it on
// sees the part. So the cell's markup must leave the part out, and the markup with the property on
// must hold it. The hand-written renderers render the part at the property's value, always, or never.
describe("the markup check of a part behind a BOOLEAN property that starts false", () => {
  const ACTION: PartDefinition = {
    ...dot(""),
    key: "action",
    slot: "chip-action",
    optional: { name: "Action", defaultValue: false },
  };
  const HOLDER = chip("flex", { parts: [dot(""), ACTION] });
  const CELLS = [{ state: "rest" }];
  const rendering = (shows: (turnedOn: ReadonlySet<string>) => boolean): CellRendering => ({
    element: (_cell, turnedOn) =>
      createElement(
        "span",
        { "data-slot": "chip" },
        createElement("span", { "data-slot": "chip-dot" }),
        shows(turnedOn) ? createElement("span", { "data-slot": "chip-action" }) : null
      ),
  });

  it("passes a renderer that renders the part only while the property is on", () => {
    expect(() =>
      checkMarkup(
        HOLDER,
        CELLS,
        rendering((turnedOn) => turnedOn.has("Action"))
      )
    ).not.toThrow();
  });

  it("fails a renderer that renders the part while the property keeps its default", () => {
    expect(() =>
      checkMarkup(
        HOLDER,
        CELLS,
        rendering(() => true)
      )
    ).toThrow("chip/state=rest: parts");
  });

  it("fails a renderer that leaves the part out with the property on", () => {
    expect(() =>
      checkMarkup(
        HOLDER,
        CELLS,
        rendering(() => false)
      )
    ).toThrow("chip/state=rest with Action on: parts");
  });
});
