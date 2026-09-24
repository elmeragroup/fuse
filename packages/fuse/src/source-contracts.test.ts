import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { overlayLayer } from "./components/overlay/overlay-classes";

/**
 * Remaining source-level invariants that are not already a lint rule
 * (`facade-reexport-grammar`, `no-rac-outside-quarantine`,
 * `no-hardcoded-density-metrics`, `no-primitive-colors`, `no-local-focus-ring`,
 * `restrict-focus-ring-call`, `restrict-browser-helper-copy`, `no-field-part-jsx`,
 * `no-tailwind-dark-variant`, `restrict-process-env`, `no-restricted-imports` for
 * `LocalizedStringDictionary`)
 * or an exports/package-check gate. Each describe documents why the contract is
 * not a lint rule.
 */
const SRC_ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SRC_ROOT, "..");

type RscStatus = "client" | "server";

type SourceRecord = {
  relative: string;
  source: string;
  code: string;
};

const CLIENT_COMPONENTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["accordion", ["components/accordion/accordion.tsx"]],
  ["alert-dialog", ["components/alert-dialog/alert-dialog.tsx"]],
  ["avatar", ["components/avatar/avatar.tsx"]],
  ["breadcrumb", ["components/breadcrumb/breadcrumb.tsx"]],
  ["button", ["components/button/button.tsx"]],
  ["button-group", ["components/button-group/button-group.tsx"]],
  ["calendar", ["react-aria/calendar/calendar.tsx"]],
  ["checkbox", ["components/checkbox/checkbox.tsx"]],
  ["checkbox-card", ["components/checkbox-card/checkbox-card.tsx"]],
  ["collapsible", ["components/collapsible/collapsible.tsx"]],
  ["combobox", ["components/combobox/combobox.tsx"]],
  ["confirm-button", ["components/confirm-button/confirm-button.tsx"]],
  ["date-field", ["react-aria/date-field/date-field.tsx"]],
  ["date-picker", ["react-aria/date-picker/date-picker.tsx"]],
  ["date-range-picker", ["react-aria/date-range-picker/date-range-picker.tsx"]],
  ["dialog", ["components/dialog/dialog.tsx"]],
  ["dropdown-menu", ["components/dropdown-menu/dropdown-menu.tsx"]],
  ["field", ["components/field/field.tsx"]],
  ["file-trigger", ["react-aria/file-trigger/file-trigger.tsx"]],
  ["focusable", ["react-aria/focusable/focusable.tsx"]],
  ["grid-list", ["react-aria/grid-list/grid-list.tsx"]],
  ["heading", ["components/heading/heading.tsx"]],
  ["input", ["components/input/input.tsx"]],
  ["input-group", ["components/input-group/input-group.tsx"]],
  ["item", ["components/item/item.tsx"]],
  ["link", ["react-aria/link/link.tsx"]],
  ["meter", ["components/meter/meter.tsx"]],
  ["number-field", ["components/number-field/number-field.tsx"]],
  ["pagination", ["components/pagination/pagination.tsx"]],
  [
    "phone-number-field",
    [
      "components/phone-number-field/phone-number-field.tsx",
      "components/phone-number-field/hooks/use-phone-number-field-state.ts",
    ],
  ],
  ["popover", ["components/popover/popover.tsx"]],
  ["popover-info-button", ["components/popover-info-button/popover-info-button.tsx"]],
  ["radio-group", ["components/radio-group/radio-group.tsx"]],
  ["range-calendar", ["react-aria/range-calendar/range-calendar.tsx"]],
  ["scroll-area", ["components/scroll-area/scroll-area.tsx"]],
  ["search-field", ["react-aria/search-field/search-field.tsx"]],
  ["select", ["components/select/select.tsx"]],
  ["selection-item", ["components/selection-item/selection-item.tsx"]],
  ["separator", ["components/separator/separator.tsx"]],
  ["sheet", ["components/sheet/sheet.tsx"]],
  ["sidebar", ["components/sidebar/sidebar.tsx"]],
  ["span", ["components/span/span.tsx"]],
  ["switch", ["components/switch/switch.tsx"]],
  ["tabs", ["components/tabs/tabs.tsx"]],
  ["text", ["components/text/text.tsx"]],
  ["text-field", ["components/text-field/text-field.tsx"]],
  ["textarea-field", ["components/textarea-field/textarea-field.tsx"]],
  ["toast", ["components/toast/toast.tsx"]],
  ["toggle", ["components/toggle/toggle.tsx"]],
  ["toggle-group", ["components/toggle-group/toggle-group.tsx"]],
  ["tooltip", ["components/tooltip/tooltip.tsx"]],
  ["ui-providers", ["react-aria/ui-providers/ui-providers.tsx"]],
];

const SERVER_COMPONENTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["alert", ["components/alert/alert.tsx"]],
  ["badge", ["components/badge/badge.tsx"]],
  ["card", ["components/card/card.tsx"]],
  ["code", ["components/code/code.tsx"]],
  ["description-list", ["components/description-list/description-list.tsx"]],
  ["emoji", ["components/emoji/emoji.tsx"]],
  ["empty", ["components/empty/empty.tsx"]],
  ["frame", ["components/frame/frame.tsx"]],
  ["loader", ["components/loader/loader.tsx"]],
  ["show", ["components/show/show.tsx"]],
  ["skeleton", ["components/skeleton/skeleton.tsx"]],
  ["table", ["components/table/table.tsx"]],
  ["textarea", ["components/textarea/textarea.tsx"]],
  ["timeline-list", ["components/timeline-list/timeline-list.tsx"]],
];

const CLIENT_ISLANDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["table", ["components/table/vertical-table-header.tsx", "components/table/vertical-table-key.tsx"]],
  ["description-list", ["components/description-list/description-list-heading.tsx"]],
];

const CLIENT_HOOKS = ["hooks/use-localized-strings.ts"] as const;

function isTestFile(path: string): boolean {
  return (
    path.endsWith(".test.ts") ||
    path.endsWith(".test.tsx") ||
    path.endsWith(".browser.test.tsx") ||
    path.endsWith(".test-d.tsx")
  );
}

function walkSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walkSourceFiles(path));
      continue;
    }
    if ((path.endsWith(".ts") || path.endsWith(".tsx")) && !isTestFile(path)) {
      files.push(path);
    }
  }
  return files;
}

/** Line-comment and block-comment lines dropped, so prose citing a spelling is not a copy of it. */
function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

function loadSourceTree(): ReadonlyMap<string, SourceRecord> {
  const tree = new Map<string, SourceRecord>();
  for (const file of walkSourceFiles(SRC_ROOT)) {
    const source = readFileSync(file, "utf8");
    tree.set(file, {
      relative: relative(SRC_ROOT, file),
      source,
      code: codeOnly(source),
    });
  }
  return tree;
}

const SOURCE_TREE = loadSourceTree();

function readSrc(relativePath: string): string {
  const record = SOURCE_TREE.get(join(SRC_ROOT, relativePath));
  if (record === undefined) {
    throw new Error(`expected source file ${relativePath}`);
  }
  return record.source;
}

function ownedBy(owner: string, needle: string): string[] {
  const ownerPath = join(SRC_ROOT, owner);
  const restating: string[] = [];
  for (const [file, record] of SOURCE_TREE) {
    if (file !== ownerPath && record.code.includes(needle)) {
      restating.push(record.relative);
    }
  }
  return restating;
}

function filesContainingCode(needle: string): string[] {
  const hits: string[] = [];
  for (const record of SOURCE_TREE.values()) {
    if (record.code.includes(needle)) {
      hits.push(record.relative);
    }
  }
  return hits;
}

function hasUseClientDirective(source: string): boolean {
  const trimmed = source.trimStart();
  return trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'");
}

function expectRsc(relativePath: string, rsc: RscStatus): void {
  const source = readSrc(relativePath);
  if (rsc === "client") {
    expect(hasUseClientDirective(source), relativePath).toBe(true);
    return;
  }
  expect(source, relativePath).not.toContain('"use client"');
  expect(source, relativePath).not.toContain("'use client'");
}

describe("RSC classification", () => {
  // Why not a lint rule: server/client compatibility is a reviewed per-component
  // decision. Package-check checks packed directives against source; this independent
  // expectation catches an unintended source-boundary change.
  it.each(CLIENT_COMPONENTS)("%s is client", (_component, files) => {
    for (const file of files) {
      expectRsc(file, "client");
    }
  });

  it.each(SERVER_COMPONENTS)("%s is server", (_component, files) => {
    for (const file of files) {
      expectRsc(file, "server");
    }
  });

  it.each(CLIENT_ISLANDS)("%s client islands are client", (_component, files) => {
    for (const file of files) {
      expectRsc(file, "client");
    }
  });

  it.each(CLIENT_HOOKS)("%s is a client hook", (file) => {
    expectRsc(file, "client");
  });

  // Why not a lint rule: "does this module own client state?" is a judgment the reviewed
  // table answers per module, not a syntactic pattern. The shared overlay close button
  // resolves its own label from the overlay dictionary, so it owns client state and
  // carries the directive; Dialog, Sheet and Sidebar were already client modules.
  it("keeps the shared overlay close button client-side — it resolves its own label", () => {
    expectRsc("components/overlay/overlay-close-button.tsx", "client");
  });

  // Why not a lint rule: same judgment as the close button above. FieldFrame holds no
  // state either, and its six consumers (TextField, NumberField, TextareaField,
  // PhoneNumberField, CheckboxGroup, RadioGroup) are client modules already, so a
  // directive would only widen the client graph.
  it("leaves the shared field frame directive-free — it owns no state", () => {
    expectRsc("components/field/field-frame.tsx", "server");
  });
});

describe("no .ref/ in package source", () => {
  // Why not a lint rule: the architecture forbids `.ref/` in package source,
  // generated declarations, and the packed artifact. Package-check covers the
  // packed artifact; this walk is the source-side half. A path-literal lint
  // rule would need a reviewed allowlist for scripts that read the snapshots.
  it("does not mention .ref/ in library source modules", () => {
    expect(SOURCE_TREE.size).toBeGreaterThan(0);
    for (const [file, record] of SOURCE_TREE) {
      expect(record.source, file).not.toContain(".ref/");
    }
  });
});

describe("deleted user-agent and @elmeragroup/lib APIs", () => {
  // Why not a lint rule: these identifiers are a retired public surface, not a
  // syntactic class of mistakes. The allowlist would be the identifiers
  // themselves.
  it("does not ship userAgent, UserAgentParserResult, or @elmeragroup/lib", () => {
    for (const [file, record] of SOURCE_TREE) {
      expect(record.source, file).not.toMatch(/\buserAgent\b/);
      expect(record.source, file).not.toMatch(/\bUserAgentParserResult\b/);
      expect(record.source, file).not.toMatch(/@elmeragroup\/lib/);
    }
    const manifest = readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8");
    expect(manifest).not.toMatch(/\buserAgent\b/);
    expect(manifest).not.toMatch(/\bUserAgentParserResult\b/);
    expect(manifest).not.toMatch(/@elmeragroup\/lib/);
  });
});

describe("combobox", () => {
  // Why not a lint rule: `@base-ui/react/combobox` type-checks and is the
  // usual subpath; it crashes at runtime with a null React context.
  // The forbidden specifier is one documented trap, not a
  // grammar.
  it("imports Combobox from the @base-ui/react package root, never the combobox subpath", () => {
    const source = readSrc("components/combobox/combobox.tsx");
    expect(source).toContain('from "@base-ui/react"');
    expect(source).not.toContain('from "@base-ui/react/combobox"');
  });
});

describe("field composites", () => {
  // Why not a lint rule: PhoneNumberField importing TextField's public recipe is a
  // one-file "do not reintroduce" coupling, not a repo-wide specifier ban. Field
  // part JSX in these composites is `elmera/no-field-part-jsx`.
  it("does not import the text-field recipe — layout comes from FieldFrame", () => {
    const source = readSrc("components/phone-number-field/phone-number-field.tsx");
    expect(source).not.toContain("text-field-variants");
    expect(source).not.toContain("textFieldVariants");
  });
});

describe("selection-item", () => {
  // Why not a lint rule: the deleted measurement path is a component-specific
  // "do not reintroduce" contract, not a repo-wide API ban.
  it("does not measure the control slot", () => {
    const source = readSrc("components/selection-item/selection-item.tsx");
    expect(source).not.toContain("ResizeObserver");
    expect(source).not.toContain("useLayoutEffect");
    expect(source).not.toContain("getBoundingClientRect");
    expect(source).not.toContain("controlSlotWidth");
  });
});

describe("density host interface", () => {
  // Why not a lint rule: ThemeProvider and ThemeScope must not mention
  // density because density is a document-root stamp, not a theme prop. The
  // word is legal elsewhere (fuse.css, density helpers).
  it("leaves ThemeProvider and ThemeScope without density behavior", () => {
    expect(readSrc("theme/theme-provider.tsx")).not.toMatch(/density/i);
    expect(readSrc("theme/theme-scope.tsx")).not.toMatch(/density/i);
  });
});

describe("react-aria internal overlay stack", () => {
  // Why not a lint rule: the invariant is the *absence* of two modules plus the
  // absence of the attribute they coupled on. The private RAC Modal and
  // overlay-container stamp were removed; a
  // picker now sits inside the public base-ui Dialog, which tracks nesting through
  // the React tree. This fails the moment either comes back by copy-paste.
  it("ships no Modal and no overlay-container coupling", () => {
    expect(existsSync(join(SRC_ROOT, "react-aria/internal/modal.tsx"))).toBe(false);
    expect(existsSync(join(SRC_ROOT, "react-aria/internal/overlay-container.ts"))).toBe(false);
    expect(readSrc("react-aria/internal/popover.tsx")).not.toContain("data-overlay-container");
    expect(readSrc("react-aria/internal/dialog.tsx")).not.toMatch(/\bModal\b/u);
  });
});

describe("Twemoji artwork fidelity", () => {
  // Why not a lint rule: the contract is that the bundled third-party artwork
  // is a verbatim lift of the Twemoji path data the NOTICE file attributes.
  // A lint rule cannot know which literal is the licensed
  // original; the path data itself is the contract, so it is pinned here.
  it("keeps the lifted Twemoji path data and fills verbatim", () => {
    const source = readSrc("components/emoji/emoji.tsx");
    expect(source).toContain('d="M25.485 27.379C25.44 27.2 24.317 23 18 23c-6.318 0-7.44 4.2-7.485 4.379');
    expect(source).toContain('d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379');
    expect(source).toContain('fill="#5DADEC"');
    expect(source).toContain('fill="#269"');
  });
});

describe("runtime listeners and layout motion", () => {
  // Why not a lint rule: both are closed lists of reviewed owners across the tree. A rule
  // banning the call or the class would need an exemption per owner and still could not
  // say the list is complete. Each owner's browser test covers its own cleanup.
  it("installs event listeners only from the reviewed owners", () => {
    expect(filesContainingCode(".addEventListener(").toSorted()).toEqual([
      "components/sidebar/sidebar.tsx",
      "hooks/use-form-reset.ts",
      "hooks/use-is-mobile.ts",
      "hooks/use-predicted-events.ts",
      "theme/theme-provider.tsx",
    ]);
  });

  it("transitions layout properties only in the reviewed places", () => {
    // Everything else animates transform, opacity and colour. The central reduced-motion
    // rule in fuse.css also disables these.
    const layoutTransition =
      /transition-(?:all|\[[^\]]*(?:height|width|padding|margin|inset|top|right|bottom|left|grid)[^\]]*\])/u;
    const owners = [...SOURCE_TREE.values()]
      .filter((record) => layoutTransition.test(record.code))
      .map((record) => record.relative);
    expect(owners.toSorted()).toEqual([
      "components/accordion/accordion-variants.ts",
      "components/meter/meter-variants.ts",
      "components/sidebar/sidebar.tsx",
      "styles/panel-height.ts",
    ]);
  });
});

describe("overlay layer", () => {
  // Why not a lint rule: the invariant is a count across two places. The shared overlay
  // module spells `z-50` once and no component restates it. A rule banning the class would
  // need an exemption for the module that owns it and could not assert "exactly once".
  it("is declared once in overlay-classes.ts and nowhere else in component source", () => {
    expect(overlayLayer).toBe("z-50");
    expect(codeOnly(readSrc("components/overlay/overlay-classes.ts")).match(/z-50/gu)).toHaveLength(1);
    expect(ownedBy("components/overlay/overlay-classes.ts", "z-50")).toEqual([]);
  });
});

describe("superseded local forms", () => {
  // Why not a lint rule: each of these is a "there is exactly one owner" count
  // across the whole tree. A rule banning the spelling would need a per-file
  // exemption for precisely its owner and still could not assert the "exactly
  // once" half. Private copies would undo the shared ownership. Calls and imports use lint
  // allow lists; class-string ownership stays
  // here because lint cannot count.
  it("spells the popup motion, fill and surface classes only in overlay-classes.ts", () => {
    for (const needle of [
      "origin-(--transform-origin)",
      "bg-popover text-popover-foreground",
      "shadow-md ring-1 ring-foreground/10",
      "pointer-events-none absolute right-2 flex items-center justify-center",
      "-mx-1 my-1 h-px bg-border",
    ]) {
      expect(ownedBy("components/overlay/overlay-classes.ts", needle), needle).toEqual([]);
    }
  });

  it("asks whether a ReactNode is text only through internal/is-text-node.ts", () => {
    // The two survivors elsewhere are not this question: Toast's manager adapter and
    // Sidebar's tooltip shorthand narrow `string | <object>` unions, and an options
    // object is not a `ReactNode` (is-text-node.ts documents both).
    for (const [file, gone] of [
      ["components/checkbox/checkbox.tsx", "function stringDescribedBy"],
      ["components/confirm-button/confirm-button.tsx", "function stringChild"],
      ["react-aria/grid-list/grid-list.tsx", "function stringChild"],
    ] as const) {
      const source = readSrc(file);
      expect(source, file).not.toContain(gone);
      expect(source, file).toContain("is-text-node");
    }
    // The `Object.prototype.toString.call(v) === "[object String]"` spelling evaded the
    // anti-slop rule rather than answering it; no source file spells it any more.
    expect(filesContainingCode("[object String]")).toEqual([]);
  });
});

/** The class tokens in source code: every run between whitespace, quotes and backticks. */
function classTokens(code: string): string[] {
  return code.split(/[\s"'`]+/u).filter((token) => token.length > 0);
}

/** Split a class token into its variants and utility at the colons outside brackets. */
function splitVariants(token: string) {
  const variants: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of token) {
    if (character === "[") depth += 1;
    if (character === "]") depth -= 1;
    if (character === ":" && depth === 0) {
      variants.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  return { variants, utility: current };
}

/** A variant that reads another element's state (`group-*`, `peer-*`, `in-*`) styles a part. */
function readsAnotherElement(variant: string): boolean {
  return /^(?:group|peer|in)-/u.test(variant);
}

/**
 * A disabled dim or pointer-events drop the control writes on itself, rather than taking
 * it from the state face.
 */
function isLocalDisabledDim(token: string): boolean {
  const { variants, utility } = splitVariants(token);
  if (!/^(?:opacity-\d+|pointer-events-none)$/u.test(utility)) return false;
  if (variants.some(readsAnotherElement)) return false;
  return variants.some(
    (variant) =>
      /^(?:disabled|data-disabled|aria-disabled|has-disabled|disabled-state)$/u.test(variant) ||
      (/^(?:data|aria|has)-\[/u.test(variant) && variant.includes("disabled"))
  );
}

/**
 * A `hover:` or `active:` face with no `enabled-*` gate in front of it. A token with no
 * utility after its last colon is an object key such as ScrollArea's `hover:` type, not a class.
 */
function isUngatedPointerFace(token: string): boolean {
  const { variants, utility } = splitVariants(token);
  return utility.length > 0 && (variants.includes("hover") || variants.includes("active"));
}

const BARE_DISABLED_DIM = /^(?:opacity-\d+|pointer-events-none)$/u;

/**
 * The bare dims a `tv` map writes inside a disabled-named variant arm (`isDisabled: { … }`
 * or `disabled: { … }`). The arm, not a selector, carries the state there, so the dim has
 * no `disabled:` variant for {@link isLocalDisabledDim} to see.
 */
function disabledArmDims(code: string): string[] {
  const dims: string[] = [];
  for (const match of code.matchAll(/\b(?:isDisabled|disabled)\s*:\s*\{/gu)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < code.length; close += 1) {
      if (code[close] === "{") depth += 1;
      if (code[close] === "}") depth -= 1;
      if (depth === 0) break;
    }
    dims.push(...classTokens(code.slice(open + 1, close)).filter((token) => BARE_DISABLED_DIM.test(token)));
  }
  return dims;
}

/**
 * The bare dims a component adds behind a disabled-named prop condition
 * (`isVisuallyDisabled && "opacity-70"` or `isDisabled ? "opacity-50" : …`). The condition,
 * not a selector or a `tv` arm, carries the state there.
 */
function disabledConditionDims(code: string): string[] {
  const dims: string[] = [];
  for (const match of code.matchAll(/\b\w*[Dd]isabled\w*\s*(?:&&|\?)\s*(["'`])([^"'`]*)\1/gu)) {
    dims.push(...classTokens(match[2] ?? "").filter((token) => BARE_DISABLED_DIM.test(token)));
  }
  return dims;
}

/** Every flagged token per file, deduplicated and sorted, for files with at least one. */
function flaggedTokensByFile(flagged: (code: string) => string[]) {
  return Object.fromEntries(
    [...SOURCE_TREE.values()]
      .map((record) => [record.relative, [...new Set(flagged(record.code))].toSorted()] as const)
      .filter(([, tokens]) => tokens.length > 0)
      .toSorted(([a], [b]) => a.localeCompare(b))
  );
}

function localDisabledDims(code: string): string[] {
  return [
    ...classTokens(code).filter(isLocalDisabledDim),
    ...disabledArmDims(code),
    ...disabledConditionDims(code),
  ];
}

function ungatedPointerFaces(code: string): string[] {
  return classTokens(code).filter(isUngatedPointerFace);
}

describe("state faces", () => {
  // Why not a lint rule: the `elmera` rules live in the external
  // `@elmeragroup/internal/oxlint` package, so this repo cannot add a sibling of
  // `no-local-focus-ring` in place, and that rule's owner path is not configurable yet
  // (see the open-work list). The upstream proposal is `no-local-state-face`. Until it ships, this walk is
  // the gate: `styles/state-face.ts` owns the disabled dim, and hover and press faces sit
  // behind the `enabled-hover:` / `enabled-active:` variants from fuse.css.
  it("recognizes a local disabled dim and an ungated pointer face, and not the gated forms", () => {
    for (const token of [
      "disabled:opacity-50",
      "data-disabled:opacity-50",
      "aria-disabled:pointer-events-none",
      "has-disabled:opacity-50",
      "has-[[data-slot=input-group-control]:disabled]:opacity-50",
      "data-open:disabled:opacity-70",
      "disabled-state:opacity-50",
    ]) {
      expect(isLocalDisabledDim(token), token).toBe(true);
    }
    for (const token of [
      "group-data-disabled/field:opacity-50",
      "peer-data-disabled:opacity-50",
      "disabled:bg-muted",
      "opacity-50",
      "data-[hovering]:pointer-events-auto",
    ]) {
      expect(isLocalDisabledDim(token), token).toBe(false);
    }
    for (const token of [
      "hover:bg-muted",
      "active:scale-[0.96]",
      "data-open:hover:bg-muted",
      "*:[a]:hover:x",
    ]) {
      expect(isUngatedPointerFace(token), token).toBe(true);
    }
    for (const token of ["enabled-hover:bg-muted", "enabled-active:scale-[0.96]", "group-hover:bg-muted"]) {
      expect(isUngatedPointerFace(token), token).toBe(false);
    }
    expect(disabledArmDims('isDisabled: { true: "opacity-75" }')).toEqual(["opacity-75"]);
    expect(disabledArmDims('disabled: { true: { root: "cursor-not-allowed pointer-events-none" } }')).toEqual(
      ["pointer-events-none"]
    );
    expect(disabledArmDims("isDisabled: { true: racDisabledStateFaceClass }")).toEqual([]);
    expect(
      disabledArmDims('variant: { muted: "opacity-50" }, isDisabled: { true: "cursor-not-allowed" }')
    ).toEqual([]);
    // Button's old dim, added behind its prop rather than a selector or a `tv` arm.
    expect(localDisabledDims('cn(base, isVisuallyDisabled && "opacity-70")')).toEqual(["opacity-70"]);
    expect(disabledConditionDims('isDisabled ? "pointer-events-none" : "cursor-pointer"')).toEqual([
      "pointer-events-none",
    ]);
    expect(localDisabledDims('isVisuallyDisabled && "cursor-not-allowed"')).toEqual([]);
    expect(disabledConditionDims('isOpen && "opacity-0"')).toEqual([]);
    expect(disabledConditionDims("isDisabled && racDisabledStateFaceClass")).toEqual([]);
  });

  it("dims a disabled control only through the state face", () => {
    // Reviewed exceptions, keyed by file and exact token so a new dim in a listed file still
    // fails: option rows inside a popup list are parts, not whole controls. They keep
    // `pointer-events-none` so the pointer never highlights a disabled option.
    const { "styles/state-face.ts": _owner, ...copies } = flaggedTokensByFile(localDisabledDims);
    expect(copies).toEqual({
      "components/overlay/overlay-classes.ts": [
        "data-disabled:opacity-50",
        "data-disabled:pointer-events-none",
      ],
      "react-aria/date-picker/date-picker.tsx": ["data-disabled:pointer-events-none"],
    });
  });

  it("gates every hover and press face on a control that can be disabled", () => {
    // Reviewed exceptions, keyed by file and exact token, none of which paints a control
    // that can be disabled. A new ungated token in a listed file still fails.
    expect(flaggedTokensByFile(ungatedPointerFaces)).toEqual({
      // The action Button's fill override; the action has no disabled state.
      "components/alert/alert-variants.ts": [
        "hover:bg-error/90",
        "hover:bg-success/90",
        "hover:bg-warning/90",
      ],
      // Links, which have no disabled state.
      "components/breadcrumb/breadcrumb.tsx": ["hover:text-foreground"],
      "components/dialog/dialog.tsx": ["*:[a]:hover:text-foreground"],
      "components/item/item-variants.ts": ["[a]:hover:bg-muted"],
      // The country trigger adds its hover and press faces only while the field is editable.
      "components/phone-number-field/phone-number-field.tsx": ["active:scale-[0.97]", "hover:bg-muted"],
      // The rail, an aria-hidden resize handle that is never disabled.
      "components/sidebar/sidebar.tsx": [
        "hover:after:bg-sidebar-border",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar",
      ],
      // Rows, which are not controls.
      "components/table/table.tsx": [
        "hover:bg-muted/72",
        "hover:bg-transparent",
        "in-data-[slot=frame]:*:[tr]:hover:*:[td]:bg-transparent",
        "in-data-[slot=frame]:*:[tr]:hover:bg-transparent",
        "in-data-[slot=frame]:hover:bg-transparent",
      ],
      // Day cells and list rows, parts whose disabled face is muted text.
      "styles/calendar.ts": ["hover:bg-muted", "hover:bg-transparent"],
      "styles/grid-list.ts": ["hover:bg-muted", "hover:bg-muted/80"],
    });
  });
});
