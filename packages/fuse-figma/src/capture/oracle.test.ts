/**
 * The coverage oracle of the capture build: what each set's coverage must hold whatever its capture
 * says, and the floor every manifest keeps.
 *
 * Unit under test: the capture build of every kit set, from its kept capture and manifest.
 * Oracles, each independent of the build's own output:
 *
 * - `unmapped` means CSS that wins in the browser and reaches no Figma field, so the kit holds none
 *   but the rows `oracles/coverage.json` keeps with a reason.
 * - A synced variable's web syntax names what a value binds (the token sync, `fuse-variable-set.ts`),
 *   so a row that maps to a literal while its value reads one has lost the binding, unless the
 *   ledger keeps it with a reason.
 * - A class whose state no cell of the matrix shows is `unshown`, and the ledger names each one by
 *   its set, part and class, so a new one, or one a cell starts to show, fails until the ledger says so.
 * - Every author declaration the browser applied to an element the capture recorded, and that the
 *   element renders visibly, lands in the coverage table under some outcome, by its class and the
 *   property it writes or each longhand it wins, as the capture split it. The ledger names, with a
 *   reason, each one that does not.
 * - A captured state the browser could not reach holds the same winners as its resting twin.
 * - A manifest names only the allowlist's fields, and an anchored one its component's `sideOffset`.
 */
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { Schema } from "effect";
import { readFileSync } from "node:fs";

import { buildComponentSets } from "../components/build-kit.ts";
import type { KitComponentSet } from "../components/build-kit.ts";
import { possibleCells, variantKey } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { fuseVariableSet } from "../fuse-variable-set.ts";
import type { InstancePlace } from "./capture-cascade.ts";
import { CAPTURE_FORMAT, CAPTURE_VERSION } from "./capture-format.ts";
import type { CapturedDeclaration, CapturedElement, SetCapture } from "./capture-format.ts";
import { keptCapture } from "./captures.ts";
import { MANIFEST_FIELDS, SAMPLE_HOST_WIDTHS } from "./manifest.ts";
import type { IconManifest, InstanceManifest, LabelManifest, PartManifest, SetManifest } from "./manifest.ts";
import { keptLedger, syncedReads, unaccountedDeclarations } from "./oracle.ts";
import type { KeptRow } from "./oracle.ts";

const MANIFESTS = KIT.map(({ manifest }) => manifest);

/** Each set the build makes, by key, built once for the file. */
const built = Effect.runPromise(
  buildComponentSets().pipe(
    Effect.map(
      (sets) => new Map(sets.map((set): readonly [string, KitComponentSet] => [set.componentSet.key, set]))
    )
  )
);

/** One set as the build makes it. */
async function setOf(key: string): Promise<KitComponentSet> {
  const set = (await built).get(key);
  if (set === undefined) {
    throw new Error(`the kit builds no set ${key}`);
  }
  return set;
}

/** Each set's kept capture and what its build accounted for, by key. */
const accountedSets = built.then(
  (sets) =>
    new Map(
      [...sets].flatMap(([key, set]) => {
        const capture = keptCapture(key);
        return capture === undefined || Result.isFailure(capture)
          ? []
          : [[key, { capture: capture.success, accounting: set.accounting }] as const];
      })
    )
);

const ledger = keptLedger();
if (Result.isFailure(ledger)) {
  throw ledger.failure;
}
const LEDGER = ledger.success;

/** The custom property each synced variable's web syntax is, as `var(--surface-pad-sm)` is `--surface-pad-sm`. */
const SYNCED: ReadonlySet<string> = (() => {
  const variables = fuseVariableSet();
  if (Result.isFailure(variables)) {
    throw variables.failure;
  }
  return new Set(
    variables.success.collections.flatMap((collection) =>
      collection.variables.flatMap(({ webSyntax }) => {
        const name = /^var\((--[\w-]+)\)$/.exec(webSyntax ?? "")?.[1];
        return name === undefined ? [] : [name];
      })
    )
  );
})();

/** A row as the ledger names it: its part, class and property. */
function named(row: Pick<KeptRow, "part" | "className" | "property">): string {
  return JSON.stringify([row.part, row.className, row.property]);
}

/** A declaration by its cell and element, `at`, and the part, class and property a ledger row names. */
function identity(at: string, row: Pick<KeptRow, "part" | "className" | "property">): string {
  return JSON.stringify([at, row.part, row.className, row.property]);
}

/** The ledger's rows of one list for a set. */
function kept(rows: readonly KeptRow[], key: string): readonly string[] {
  return rows.filter((row) => row.set === key).map(named);
}

/** The host widths a manifest and the manifests its instance parts show name, by set. */
function hostWidthsOf(manifest: SetManifest): readonly { readonly set: string; readonly width: number }[] {
  const seen = new Set<SetManifest>();
  const found: { readonly set: string; readonly width: number }[] = [];
  const visit = (each: SetManifest): void => {
    if (seen.has(each)) {
      return;
    }
    seen.add(each);
    if (each.previewWidth !== undefined) {
      found.push({ set: each.key, width: each.previewWidth });
    }
    const parts = (list: readonly (PartManifest | InstanceManifest)[]): void => {
      for (const part of list) {
        if ("kind" in part) {
          visit(part.of);
        } else {
          parts(part.parts ?? []);
        }
      }
    };
    parts(each.parts ?? []);
  };
  visit(manifest);
  return found;
}

/**
 * Each field of a manifest's objects that its kind's allowlist lacks, as `kind key.field`: the set,
 * its label, its icons in every cell, its parts, and the sets its instance parts show.
 */
function fieldsOutsideAllowlist(manifest: SetManifest): readonly string[] {
  const found: string[] = [];
  const seen = new Set<SetManifest>();
  const check = (
    kind: keyof typeof MANIFEST_FIELDS,
    object: SetManifest | PartManifest | InstanceManifest | LabelManifest | IconManifest,
    name: string
  ): void => {
    const allowed: ReadonlySet<string> = new Set(MANIFEST_FIELDS[kind]);
    for (const field of Object.keys(object)) {
      if (!allowed.has(field)) {
        found.push(`${kind} ${name}.${field}`);
      }
    }
  };
  const box = (
    object: SetManifest | PartManifest,
    name: string,
    cells: readonly Record<string, string>[]
  ): void => {
    if (object.label !== undefined) {
      check("label", object.label, name);
    }
    for (const cell of cells) {
      for (const icon of object.iconsFor(cell)) {
        check("icon", icon, name);
      }
    }
  };
  const part = (each: PartManifest | InstanceManifest, cells: readonly Record<string, string>[]): void => {
    if ("kind" in each) {
      check("instance", each, each.key);
      set(each.of);
      return;
    }
    check("part", each, each.key);
    box(each, each.key, cells);
    for (const below of each.parts ?? []) {
      part(below, cells);
    }
  };
  const set = (each: SetManifest): void => {
    if (seen.has(each)) {
      return;
    }
    seen.add(each);
    const cells = possibleCells(each);
    check("set", each, each.key);
    box(each, each.key, cells);
    for (const below of each.parts ?? []) {
      part(below, cells);
    }
  };
  set(manifest);
  return found;
}

describe.each(MANIFESTS.map((manifest) => [manifest.key, manifest] as const))(
  "the capture build of %s",
  (key, manifest) => {
    it("leaves no row unmapped but the ones the ledger keeps", async () => {
      const set = await setOf(key);
      const unmapped = [...new Set(set.coverage.filter((row) => row.outcome === "unmapped").map(named))];
      expect(unmapped.toSorted()).toEqual([...kept(LEDGER.unmapped, key)].toSorted());
    });

    it("binds every mapped row that reads a synced variable, but the ones the ledger keeps", async () => {
      const set = await setOf(key);
      const literal = set.coverage.filter(
        (row) => row.outcome === "literal" && syncedReads(String(row.value), SYNCED).length > 0
      );
      expect([...new Set(literal.map(named))].toSorted()).toEqual([...kept(LEDGER.unbound, key)].toSorted());
    });

    it("accounts for every declaration its capture records, but the ones the ledger keeps", async () => {
      const sets = await accountedSets;
      // Each declaration by its cell and element, so an exception excuses exactly the ones it lists.
      const unaccounted = unaccountedDeclarations(key, (each) => sets.get(each)).map((row) =>
        identity(row.at, row)
      );
      const listed = LEDGER.unreached
        .filter((row) => row.set === key)
        .flatMap((row) => row.at.map((at) => identity(at, row)));
      expect(unaccounted.toSorted()).toEqual(listed.toSorted());
    });

    it("names each unshown row in the ledger", async () => {
      const set = await setOf(key);
      const unshown = set.coverage
        .filter((row) => row.outcome === "unshown")
        .map((row) => JSON.stringify([row.part, row.className]));
      const listed = (LEDGER.unshown[key] ?? []).map((row) => JSON.stringify([row.part, row.className]));
      expect([...new Set(unshown)].toSorted()).toEqual([...listed].toSorted());
    });

    it("draws every state its matrix names, unlike the cell at rest", () => {
      // A state the capture could not reach would hold the same winners as its resting twin, as a
      // `state-missing` cell of figma:compare does. A cell the capture marks as drawing as at rest
      // reached no rule while another cell reached the same state, which the capture checked.
      const capture = keptCapture(key);
      if (capture === undefined || Result.isFailure(capture)) {
        throw new Error(`captures/${key}.json does not read`);
      }
      const cells = new Map(capture.success.cells.map((cell) => [cell.key, cell] as const));
      const missing = capture.success.cells.flatMap((cell) => {
        if (cell.cell.state === undefined || cell.cell.state === "rest" || cell.drawsAsRest === true) {
          return [];
        }
        const rest = cells.get(variantKey(manifest, { ...cell.cell, state: "rest" }));
        return rest !== undefined && JSON.stringify(rest.roots) === JSON.stringify(cell.roots)
          ? [cell.key]
          : [];
      });
      expect(missing).toEqual([]);
    });

    it("names only the allowlist's fields in its manifest", () => {
      expect(fieldsOutsideAllowlist(manifest)).toEqual([]);
    });

    it("sizes its sample's host only with a plain host width", () => {
      // A width computed from a component's own CSS, as a popup's minimum less its padding, must
      // come from the capture, which measures it.
      expect(hostWidthsOf(manifest).filter(({ width }) => !SAMPLE_HOST_WIDTHS.has(width))).toEqual([]);
    });
  }
);

describe("the coverage ledger", () => {
  it("names only sets the kit builds", () => {
    const keys = new Set(MANIFESTS.map(({ key }) => key));
    const named = [
      ...LEDGER.unmapped.map(({ set }) => set),
      ...LEDGER.unbound.map(({ set }) => set),
      ...Object.keys(LEDGER.unshown),
      ...LEDGER.unreached.map(({ set }) => set),
    ];
    expect(named.filter((key) => !keys.has(key))).toEqual([]);
  });
});

/**
 * The docs' API reference of each anchored composite's popup part: the component's page and the
 * part whose `sideOffset` and `alignItemWithTrigger` defaults the manifest names. Each anchored
 * manifest must have a row, so a new one decides where its placement props come from.
 */
const PLACEMENT_SOURCES: ReadonlyMap<string, { readonly page: string; readonly part: string }> = new Map([
  ["select-open", { page: "select", part: "Select.Content" }],
  ["popover-open", { page: "popover", part: "Popover.Content" }],
  ["dropdown-menu-open", { page: "dropdown-menu", part: "DropdownMenu.Content" }],
  ["combobox-open", { page: "combobox", part: "Combobox.Content" }],
  ["tooltip-open", { page: "tooltip", part: "Tooltip.Content" }],
]);

const ApiReference = Schema.Struct({
  parts: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      props: Schema.Array(
        Schema.Struct({ name: Schema.String, defaultValue: Schema.optionalKey(Schema.NullOr(Schema.String)) })
      ),
    })
  ),
});

/** A prop's declared default in a component's generated API reference, as its JSON text. */
function apiDefault(page: string, part: string, prop: string): string | null | undefined {
  const path = new URL(`../../../../apps/docs/src/app/(docs)/components/${page}/api.json`, import.meta.url);
  const reference = Schema.decodeUnknownSync(ApiReference)(JSON.parse(readFileSync(path, "utf8")));
  return reference.parts.find((each) => each.name === part)?.props.find((each) => each.name === prop)
    ?.defaultValue;
}

describe.each(
  MANIFESTS.flatMap((manifest) =>
    manifest.sideOffset === undefined ? [] : [[manifest.key, manifest] as const]
  )
)("the anchored manifest %s", (key, manifest) => {
  it("names its popup's sideOffset as the component's API reference declares it", () => {
    const source = PLACEMENT_SOURCES.get(key);
    expect(source).toBeDefined();
    if (source !== undefined) {
      expect(String(manifest.sideOffset)).toBe(apiDefault(source.page, source.part, "sideOffset"));
    }
  });
});

/** A declaration a class of the element itself wins, as the fixtures below write them. */
function written(className: string, property: string, value: string): CapturedDeclaration {
  return {
    property,
    value,
    important: false,
    longhands: [property],
    source: "fuse",
    layer: "utilities",
    selector: `.${className}`,
    className,
    owner: 0,
  };
}

/** A `<span>` with a `data-slot` that wins the declarations at the given indexes. */
function span(slot: string, declarations: readonly number[], children: readonly CapturedElement[] = []) {
  return {
    tag: "span",
    attributes: { "data-slot": slot },
    classes: [],
    text: "",
    declarations,
    initial: [],
    pseudo: {},
    variables: {},
    unmatched: [],
    children,
  };
}

/** A one-cell capture of a root, its declarations and its cell's key. */
function oneCell(
  key: string,
  declarations: readonly CapturedDeclaration[],
  root: CapturedElement
): SetCapture {
  return {
    format: CAPTURE_FORMAT,
    version: CAPTURE_VERSION,
    set: key,
    environment: { chromium: "", theme: "", locale: "" },
    page: [],
    declarations,
    cells: [{ key: `${key}/state=rest`, cell: { state: "rest" }, roots: [{ around: [], root }] }],
  };
}

/**
 * Unit under test: `unaccountedDeclarations`'s rule for an element that renders nothing visible.
 * Oracle: CSS Display 3 §2.5, under which `display: none` generates no box for the element or
 * anything below it, and `display: contents` generates no box of its own, so its children render;
 * and CSS Masking 1 §6.1, under which `inset()` clips an element's box inward by each offset, so
 * `inset(50%)` leaves no area, `inset(40%)` a fifth of each axis, and a clip on an element with no box
 * clips nothing. Chromium paints the positioned child of a `display: contents; clip-path:
 * inset(50%)` element, as review round 1 of B5 measured.
 */
describe("a declaration on an element that renders nothing", () => {
  /** The unaccounted classes below a child that wins the hiding declarations, which the build read. */
  function unaccountedUnder(hiding: Readonly<Record<string, string>>): readonly string[] {
    const hiders = Object.entries(hiding).map(([property, value]) => written("hider", property, value));
    const margin = hiders.length;
    const capture = oneCell(
      "sample",
      [...hiders, written("mt-4", "margin-top", "1rem")],
      span(
        "root",
        [],
        [
          span(
            "child",
            hiders.map((_, index) => index),
            [span("leaf", [margin])]
          ),
        ]
      )
    );
    // The build read the hiding declarations, so only the margin below them can go unaccounted.
    const accounted = new Set(hiders.map((_, index) => `0/root/0#${String(index)}`));
    const set = { capture, accounting: new Map([["sample/state=rest", { accounted, instances: [] }]]) };
    return unaccountedDeclarations("sample", () => set).map(({ className }) => className);
  }

  it("is left out below `display: none`", () => {
    expect(unaccountedUnder({ display: "none" })).toEqual([]);
  });

  it("is left out below `clip-path: inset(50%)`, which clips to no area", () => {
    expect(unaccountedUnder({ "clip-path": "inset(50%)" })).toEqual([]);
  });

  it("counts below `clip-path: inset(40%)`, which leaves a fifth of each axis", () => {
    expect(unaccountedUnder({ "clip-path": "inset(40%)" })).toEqual(["mt-4"]);
  });

  it("counts below `display: contents` with `clip-path: inset(50%)`, which clips no box", () => {
    expect(unaccountedUnder({ display: "contents", "clip-path": "inset(50%)" })).toEqual(["mt-4"]);
  });
});

/**
 * Unit under test: whose a captured declaration is, by element. Oracle: the capture's element tree.
 * A declaration belongs to the element that wins it, whatever another element carries, and below an
 * instance part's inner root to the inner set exactly where the inner set's own capture wins the same
 * declaration at the same place, as review round 1 of B5 asked, and only where the inner set's own
 * walk checks it there: an inner element that renders nothing lends nothing, since CSS Display 3
 * §2.5 gives `display: none` no box and the inner check skips it, as review round 2 of B5 found.
 */
describe("the element a captured declaration belongs to", () => {
  it("is its own, so the root's read background does not stand in for its child's", () => {
    const capture = oneCell(
      "sample",
      [written("bg-red", "background-color", "red")],
      span("sample", [0], [span("lost-child", [0])])
    );
    const accounting = new Map([["sample/state=rest", { accounted: new Set(["0/root#0"]), instances: [] }]]);
    expect(unaccountedDeclarations("sample", () => ({ capture, accounting }))).toEqual([
      {
        part: "lost-child",
        at: "sample/state=rest 0/root/0",
        className: "bg-red",
        property: "background-color",
        value: "red",
      },
    ]);
  });

  // Oracle: the capture's winners. The host and its `::before` box each win their own `color` of one
  // class, two declarations a ledger exception for one of them must not both excuse.
  it("is its own box's, so a class's color on the host and on its ::before box are two", () => {
    const capture = oneCell(
      "sample",
      [
        written("tint", "color", "red"),
        { ...written("tint", "color", "blue"), selector: ".tint::before" },
        { ...written("tint", "content", '""'), selector: ".tint::before" },
      ],
      { ...span("sample", [0]), pseudo: { before: [1, 2] } }
    );
    const accounting = new Map([["sample/state=rest", { accounted: new Set(["0/root#2"]), instances: [] }]]);
    expect(unaccountedDeclarations("sample", () => ({ capture, accounting }))).toEqual([
      { part: "sample", at: "sample/state=rest 0/root", className: "tint", property: "color", value: "red" },
      {
        part: "sample",
        at: "sample/state=rest 0/root::before",
        className: "tint",
        property: "color",
        value: "blue",
      },
    ]);
  });

  it("is the inner set's where its own capture wins it there, and the composite's where it passes it", () => {
    const own = written("bg-primary", "background-color", "var(--primary)");
    const passed = written("w-fit", "width", "fit-content");
    const inner = oneCell("inner", [own], span("inner", [], [span("glyph", [0])]));
    const composite = oneCell(
      "composite",
      [own, passed],
      span("composite", [], [span("inner", [1], [span("glyph", [0])])])
    );
    const sets = new Map([
      [
        "inner",
        {
          capture: inner,
          accounting: new Map([["inner/state=rest", { accounted: new Set<string>(), instances: [] }]]),
        },
      ],
      [
        "composite",
        {
          capture: composite,
          accounting: new Map([
            [
              "composite/state=rest",
              {
                accounted: new Set<string>(),
                instances: [{ place: "0/root/0", set: "inner", cell: "inner/state=rest" }],
              },
            ],
          ]),
        },
      ],
    ]);
    expect(unaccountedDeclarations("composite", (key) => sets.get(key))).toEqual([
      {
        part: "inner",
        at: "composite/state=rest 0/root/0",
        className: "w-fit",
        property: "width",
        value: "fit-content",
      },
    ]);
  });
  it("stays the composite's where the inner set's matching element is hidden, which its own walk skips", () => {
    // Button's sample hides an extra span with `display: none`; Toolbar's button shows it.
    const tint = written("bg-secondary", "background-color", "var(--secondary)");
    const hide = written("hidden", "display", "none");
    const inner = oneCell("inner", [tint, hide], span("inner", [], [span("extra", [0, 1])]));
    const composite = oneCell(
      "composite",
      [tint],
      span("composite", [], [span("inner", [], [span("extra", [0])])])
    );
    const accounting = (key: string, instances: readonly InstancePlace[]) =>
      new Map([[`${key}/state=rest`, { accounted: new Set<string>(), instances }]]);
    const sets = new Map([
      ["inner", { capture: inner, accounting: accounting("inner", []) }],
      [
        "composite",
        {
          capture: composite,
          accounting: accounting("composite", [
            { place: "0/root/0", set: "inner", cell: "inner/state=rest" },
          ]),
        },
      ],
    ]);
    expect(unaccountedDeclarations("composite", (key) => sets.get(key))).toEqual([
      {
        part: "extra",
        at: "composite/state=rest 0/root/0/0",
        className: "bg-secondary",
        property: "background-color",
        value: "var(--secondary)",
      },
    ]);
  });

  // Oracle: CSS Display 3 §2.5. The inner set's `::before` wins `before:hidden`, so it generates no box
  // and its own check covers nothing it sets, `before:bg-red` included. The composite's `::before`
  // shows that fill, so the hidden inner box lends it nothing and it stays the composite's.
  it("stays the composite's on a shown pseudo-element where the inner set's is `display: none`", () => {
    const paint = {
      ...written("before:bg-red", "background-color", "red"),
      selector: ".before\\:bg-red::before",
    };
    const hide = { ...written("before:hidden", "display", "none"), selector: ".before\\:hidden::before" };
    const inner = oneCell("inner", [paint, hide], { ...span("inner", []), pseudo: { before: [0, 1] } });
    const composite = oneCell(
      "composite",
      [paint],
      span("composite", [], [{ ...span("inner", []), pseudo: { before: [0] } }])
    );
    const accounting = (key: string, instances: readonly InstancePlace[]) =>
      new Map([[`${key}/state=rest`, { accounted: new Set<string>(), instances }]]);
    const sets = new Map([
      ["inner", { capture: inner, accounting: accounting("inner", []) }],
      [
        "composite",
        {
          capture: composite,
          accounting: accounting("composite", [
            { place: "0/root/0", set: "inner", cell: "inner/state=rest" },
          ]),
        },
      ],
    ]);
    expect(unaccountedDeclarations("inner", (key) => sets.get(key))).toEqual([]);
    expect(unaccountedDeclarations("composite", (key) => sets.get(key))).toEqual([
      {
        part: "inner",
        at: "composite/state=rest 0/root/0::before",
        className: "before:bg-red",
        property: "background-color",
        value: "red",
      },
    ]);
  });

  // Oracle: the declaration's `owner`, the steps up to the element whose class its rule selects
  // through. Tag's own sample carries `tint` on its root, one step above the label, and the composite
  // carries it on its own root, two steps up, outside the instance, so the composite's markup turns it
  // on and Tag's own win of the same declaration lends it nothing.
  it("stays the composite's where its own element above the instance supplied the class", () => {
    const tint = { ...written("tint", "color", "red"), selector: ".tint [data-slot=label]" };
    const inner = oneCell("inner", [{ ...tint, owner: 1 }], span("inner", [], [span("label", [0])]));
    const composite = oneCell(
      "composite",
      [{ ...tint, owner: 2 }],
      span("composite", [], [span("inner", [], [span("label", [0])])])
    );
    const accounting = (key: string, instances: readonly InstancePlace[]) =>
      new Map([[`${key}/state=rest`, { accounted: new Set<string>(), instances }]]);
    const sets = new Map([
      ["inner", { capture: inner, accounting: accounting("inner", []) }],
      [
        "composite",
        {
          capture: composite,
          accounting: accounting("composite", [
            { place: "0/root/0", set: "inner", cell: "inner/state=rest" },
          ]),
        },
      ],
    ]);
    expect(unaccountedDeclarations("composite", (key) => sets.get(key))).toEqual([
      {
        part: "label",
        at: "composite/state=rest 0/root/0/0",
        className: "tint",
        property: "color",
        value: "red",
      },
    ]);
  });

  // Oracle: the capture's winners. The inner set wins `text-red` on its glyph's `::before` box and the
  // composite on the glyph itself, two boxes, so the inner set's check of its pseudo-element accounts
  // for nothing the composite's glyph draws.
  it("stays the composite's on the host where the inner set wins it only on a pseudo-element", () => {
    const tint = written("text-red", "color", "red");
    const inner = oneCell(
      "inner",
      [tint],
      span("inner", [], [{ ...span("glyph", []), pseudo: { before: [0] } }])
    );
    const composite = oneCell(
      "composite",
      [tint],
      span("composite", [], [span("inner", [], [span("glyph", [0])])])
    );
    const accounting = (key: string, instances: readonly InstancePlace[]) =>
      new Map([[`${key}/state=rest`, { accounted: new Set<string>(), instances }]]);
    const sets = new Map([
      ["inner", { capture: inner, accounting: accounting("inner", []) }],
      [
        "composite",
        {
          capture: composite,
          accounting: accounting("composite", [
            { place: "0/root/0", set: "inner", cell: "inner/state=rest" },
          ]),
        },
      ],
    ]);
    expect(unaccountedDeclarations("composite", (key) => sets.get(key))).toEqual([
      {
        part: "glyph",
        at: "composite/state=rest 0/root/0/0",
        className: "text-red",
        property: "color",
        value: "red",
      },
    ]);
  });
});
