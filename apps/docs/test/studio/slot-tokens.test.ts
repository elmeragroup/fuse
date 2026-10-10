import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { fuseSrc } from "../../scripts/lib/paths";
import { STUDIO_SLOT_TOKENS } from "../../src/generated/studio-slot-tokens";
import { buildSlotTokenIndex, declaredSlots, recipeModules } from "../../src/studio/generate/slot-tokens";
import type { SlotTokenComponent } from "../../src/studio/generate/slot-tokens";
import { nearestSlot, partTokens } from "../../src/studio/lib/slot-tokens";

const token = (name: string) => ({ name, isColor: true });

const source = (file: string, text: string) => ({ path: file, text });

/** A component's recipe surface, read from Fuse the way the docs generation pass reads it. */
function fuseComponent(slug: string): SlotTokenComponent {
  const dir = path.join(fuseSrc, "components", slug);
  return { slug, dir, modules: recipeModules(dir), tokens: [] };
}

describe("declaredSlots", () => {
  it("reads every literal slot a source writes, in any of the forms Fuse writes them", () => {
    const source = [
      `const a = <div data-slot="card" className={cn(card(), className)} />;`,
      `const b = <p data-slot={"card-title"} />;`,
      `const props = { "data-slot": "card-footer", ...rest };`,
      `const c = <SelectionItem.Shell dataSlot="radio-group-item" />;`,
      `const d = useRender({ render, state: { slot: "heading" } });`,
      `const e = <span data-slot={slot} />;`,
      `const f = <Text slot="description" />;`,
      `const g = <div data-slot="card" />;`,
    ].join("\n");
    expect(declaredSlots("card.tsx", source)).toEqual([
      "card",
      "card-title",
      "card-footer",
      "radio-group-item",
      "heading",
    ]);
  });

  it("finds a slot of each form Fuse writes in its own sources", () => {
    const read = (file: string) =>
      declaredSlots(file, readFileSync(path.join(fuseSrc, "components", file), "utf8"));
    expect(read("heading/heading.tsx")).toContain("heading");
    expect(read("table/table.tsx")).toContain("vertical-table");
    expect(read("field/field.tsx")).toContain("field-description");
    expect(read("checkbox/checkbox-item.tsx")).toContain("checkbox-item");
  });
});

describe("buildSlotTokenIndex", () => {
  it("files a slot under the component whose slug prefixes it, over one that only imports it", () => {
    const index = buildSlotTokenIndex([
      {
        slug: "alert-dialog",
        dir: "/c/alert-dialog",
        modules: [
          source("/c/button/button.tsx", `<button data-slot="button" />`),
          source("/c/alert-dialog/footer.tsx", `<div data-slot="alert-dialog-footer" />`),
        ],
        tokens: [token("--background")],
      },
      {
        slug: "button",
        dir: "/c/button",
        modules: [source("/c/button/button.tsx", `<button data-slot="button" />`)],
        tokens: [token("--primary"), token("--ring")],
      },
      {
        slug: "dialog",
        dir: "/c/dialog",
        modules: [
          source("/c/dialog/dialog.tsx", `<div data-slot="dialog-footer" />`),
          source("/c/overlay/scrim.tsx", `<div data-slot="overlay-scrim" />`),
        ],
        tokens: [token("--popover")],
      },
    ]);
    expect(index.slots).toEqual({
      button: "button",
      "alert-dialog-footer": "alert-dialog",
      "dialog-footer": "dialog",
      "overlay-scrim": "dialog",
    });
    expect(index.components).toEqual({
      "alert-dialog": ["--background"],
      button: ["--primary", "--ring"],
      dialog: ["--popover"],
    });
  });

  it("files a slot under the component that declares it in its own sources", () => {
    const pagination = {
      slug: "pagination",
      dir: "/c/pagination",
      modules: [source("/c/table/link.tsx", `<a data-slot="page-link" />`)],
      tokens: [],
    };
    const table = {
      slug: "table",
      dir: "/c/table",
      modules: [source("/c/table/link.tsx", `<a data-slot="page-link" />`)],
      tokens: [],
    };
    expect(buildSlotTokenIndex([pagination, table]).slots).toEqual({ "page-link": "table" });
    expect(buildSlotTokenIndex([table, pagination]).slots).toEqual({ "page-link": "table" });
  });

  it("prefers the longest slug that prefixes a slot", () => {
    // Both import the declaring module, so neither owns it and only the prefix can decide.
    const input = {
      slug: "input",
      dir: "/c/input",
      modules: [source("/c/shared/addon.tsx", `<div data-slot="input-group-addon" />`)],
      tokens: [],
    };
    const inputGroup = {
      slug: "input-group",
      dir: "/c/input-group",
      modules: [source("/c/shared/addon.tsx", `<div data-slot="input-group-addon" />`)],
      tokens: [],
    };
    expect(buildSlotTokenIndex([input, inputGroup]).slots).toEqual({ "input-group-addon": "input-group" });
    expect(buildSlotTokenIndex([inputGroup, input]).slots).toEqual({ "input-group-addon": "input-group" });
  });

  it("gives Table its vertical-table parts, whatever order DataTable and Table come in", () => {
    const components = [fuseComponent("data-table"), fuseComponent("table")];
    for (const order of [components, components.toReversed()]) {
      const { slots } = buildSlotTokenIndex(order);
      expect([slots["vertical-table"], slots["vertical-table-body"], slots["vertical-table-header"]]).toEqual(
        ["table", "table", "table"]
      );
    }
  });
});

describe("the generated slot index", () => {
  it("gives a heading the tokens Heading reads", () => {
    const read = partTokens(STUDIO_SLOT_TOKENS, "heading");
    expect(read?.component).toBe("heading");
    // Heading's recipe paints text-foreground by default and text-primary in its primary variant.
    expect(read?.tokens).toContain("foreground");
    expect(read?.tokens).toContain("primary");
  });
});

describe("nearestSlot", () => {
  it("picks the element itself when it carries a slot", () => {
    expect(nearestSlot(["button", "card-footer", "card"])).toEqual({ index: 0, slot: "button" });
  });

  it("walks up past elements without a slot to the nearest ancestor that has one", () => {
    expect(nearestSlot([undefined, "", undefined, "card-title", "card"])).toEqual({
      index: 3,
      slot: "card-title",
    });
  });

  it("finds nothing in a chain without a slot", () => {
    expect(nearestSlot([undefined, undefined])).toBeUndefined();
    expect(nearestSlot([])).toBeUndefined();
  });
});

describe("partTokens", () => {
  const index = {
    slots: { button: "button", "card-title": "card" },
    components: {
      button: ["--control-h-md", "--primary-foreground", "--primary", "--ring"],
      card: ["--card", "--card-foreground"],
    },
  };

  it("lists the role tokens of the slot's component in contract order, without metrics", () => {
    expect(partTokens(index, "button")).toEqual({
      component: "button",
      tokens: ["primary", "primary-foreground", "ring"],
    });
  });

  it("knows nothing about a slot no component declares", () => {
    expect(partTokens(index, "shape-row")).toBeUndefined();
  });
});
