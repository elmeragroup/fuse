import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Remaining source-level invariants that are not already a lint rule
 * (`facade-reexport-grammar`, `no-rac-outside-quarantine`,
 * `no-hardcoded-density-metrics`, `no-primitive-colors`, `no-local-focus-ring`,
 * `no-tailwind-dark-variant`, `restrict-process-env`) or an
 * exports/package-check gate. Each describe documents why the contract is not a
 * lint rule.
 */
const SRC_ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SRC_ROOT, "..");

type RscStatus = "client" | "server";

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

const CLIENT_HOOKS = ["hooks/use-localized-strings.ts", "theme/use-resolved-portal-container.ts"] as const;

function readSrc(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), "utf8");
}

function hasUseClientDirective(source: string): boolean {
  const trimmed = source.trimStart();
  return trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'");
}

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

function expectRsc(relativePath: string, rsc: RscStatus): void {
  const source = readSrc(relativePath);
  if (rsc === "client") {
    expect(hasUseClientDirective(source), relativePath).toBe(true);
    return;
  }
  expect(source, relativePath).not.toContain('"use client"');
  expect(source, relativePath).not.toContain("'use client'");
}

function orientationLiteral(sourceText: string, key: "vertical" | "horizontal" | "responsive"): string {
  const match = new RegExp(`${key}:\\s*"([^"]*)"`).exec(sourceText);
  if (match?.[1] === undefined) {
    throw new Error(`expected a literal ${key} orientation string`);
  }
  return match[1];
}

function classTokens(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

describe("RSC classification", () => {
  // Why not a lint rule: performance.md §3 is a per-component table, not a
  // syntactic pattern. Package-check asserts packed JS matches source
  // directives; this suite asserts source matches the spec table.
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

  // Why not a lint rule: "does this module own client state?" is a judgment the spec
  // table answers per module, not a syntactic pattern. The shared overlay close button
  // renders a Button and holds nothing, and both consumers (Dialog, Sheet) are already
  // client modules, so a directive here would only widen the client graph.
  it("leaves the shared overlay close button directive-free — it owns no state", () => {
    expectRsc("components/overlay/overlay-close-button.tsx", "server");
  });

  // Why not a lint rule: same judgment as the close button above. FieldFrame holds no
  // state either, and its three consumers (TextField, NumberField, TextareaField) are
  // client modules already, so a directive would only widen the client graph.
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
    const files = walkSourceFiles(SRC_ROOT);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toContain(".ref/");
    }
  }, 30_000);
});

describe("deleted user-agent and @elmeragroup/lib APIs", () => {
  // Why not a lint rule: these identifiers are a retired public surface, not a
  // syntactic class of mistakes. The allowlist would be the identifiers
  // themselves.
  it("does not ship userAgent, UserAgentParserResult, or @elmeragroup/lib", () => {
    const files = walkSourceFiles(SRC_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\buserAgent\b/);
      expect(text, file).not.toMatch(/\bUserAgentParserResult\b/);
      expect(text, file).not.toMatch(/@elmeragroup\/lib/);
    }
    const manifest = readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8");
    expect(manifest).not.toMatch(/\buserAgent\b/);
    expect(manifest).not.toMatch(/\bUserAgentParserResult\b/);
    expect(manifest).not.toMatch(/@elmeragroup\/lib/);
  }, 30_000);
});

describe("combobox", () => {
  // Why not a lint rule: `@base-ui/react/combobox` type-checks and is the
  // usual subpath; it crashes at runtime with a null React context
  // (combobox.md §8). The forbidden specifier is one documented trap, not a
  // grammar.
  it("imports Combobox from the @base-ui/react package root, never the combobox subpath", () => {
    const source = readSrc("components/combobox/combobox.tsx");
    expect(source).toContain('from "@base-ui/react"');
    expect(source).not.toContain('from "@base-ui/react/combobox"');
  });
});

describe("field", () => {
  // Why not a lint rule: the responsive orientation face is a private recipe
  // derivation from the vertical and horizontal literals. That is a data
  // relationship, not a grammar oxlint can name without encoding the recipe.
  it("derives responsive orientation tokens from the vertical and horizontal literals", () => {
    const source = readSrc("components/field/field.tsx");
    const vertical = orientationLiteral(source, "vertical");
    const horizontal = orientationLiteral(source, "horizontal");
    const responsive = orientationLiteral(source, "responsive");
    const fieldGroupMd = "@md/field-group:";
    const derived = [
      ...classTokens(horizontal).map((token) => `${fieldGroupMd}${token}`),
      `${fieldGroupMd}*:w-auto`,
      ...classTokens(vertical),
    ];
    expect(classTokens(responsive).toSorted()).toEqual(derived.toSorted());
  });
});

describe("field composites", () => {
  // Why not a lint rule: a one-off do-not-reintroduce ban (ADR 0008). These three
  // composites each rebuilt the label row, description and error before the shared
  // frame took ownership (field.md §8.9); the ban keeps that markup from growing back
  // here. It is not a repo-wide API ban — Field's own demos and every composite outside
  // this list render these parts directly, and the frame itself must. What the parts do
  // once rendered is asserted behaviourally by each composite's browser suite and by
  // `field-frame.browser.test.tsx`.
  it.each([
    "components/text-field/text-field.tsx",
    "components/number-field/number-field.tsx",
    "components/textarea-field/textarea-field.tsx",
  ])("%s renders no label, description, or error markup of its own", (file) => {
    const source = readSrc(file);
    // JSX openers only: the prop docs still name the parts the frame renders, and the
    // docs generator publishes that text.
    for (const part of ["<Field.Label", "<Field.Description", "<Field.Error", "<Field.Root"]) {
      expect(source, part).not.toContain(part);
    }
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

describe("ThemeProvider color-scheme store seam", () => {
  // Why not a lint rule: the invariant is "no store mutation during render,
  // only inside useInsertionEffect". That is a React-phase constraint, not a
  // name or import grammar.
  it("does not mutate the retained color-scheme store during render", () => {
    const source = readSrc("theme/theme-provider.tsx");
    const writerStart = source.indexOf("function DocumentThemeWriter");
    const writerEnd = source.indexOf("export function useTheme");
    expect(writerStart).toBeGreaterThan(-1);
    expect(writerEnd).toBeGreaterThan(writerStart);
    const writer = source.slice(writerStart, writerEnd);
    const [renderPhase, ...insertionAndRest] = writer.split("useInsertionEffect");
    expect(insertionAndRest.length).toBeGreaterThan(0);
    expect(renderPhase).not.toMatch(/store\.(updateConfig|applyConfig|commitConfig|discardConfig)\(/);
    expect(writer).toMatch(/store\.applyConfig\(/);
    expect(writer).toMatch(/store\.commitConfig\(/);
    expect(writer).toMatch(/useInsertionEffect\(/);
  });
});

describe("density host interface", () => {
  // Why not a lint rule: ThemeProvider and ThemeScope must not mention
  // density because density is a document-root stamp, not a theme prop. The
  // word is legal elsewhere (ui.css, density helpers).
  it("leaves ThemeProvider and ThemeScope without density behavior", () => {
    expect(readSrc("theme/theme-provider.tsx")).not.toMatch(/density/i);
    expect(readSrc("theme/theme-scope.tsx")).not.toMatch(/density/i);
  });
});

describe("react-aria internal overlay stack", () => {
  // Why not a lint rule: the invariant is the *absence* of two modules plus the
  // absence of the attribute they coupled on. Spec 08 / date-picker.md §6
  // (2026-09-03) deleted the private RAC Modal and the overlay-container stamp; a
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
  // is a verbatim lift of the Twemoji path data the NOTICE file attributes
  // (emoji.md §5). A lint rule cannot know which literal is the licensed
  // original; the path data itself is the contract, so it is pinned here.
  it("keeps the lifted Twemoji path data and fills verbatim", () => {
    const source = readSrc("components/emoji/emoji.tsx");
    expect(source).toContain('d="M25.485 27.379C25.44 27.2 24.317 23 18 23c-6.318 0-7.44 4.2-7.485 4.379');
    expect(source).toContain('d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379');
    expect(source).toContain('fill="#5DADEC"');
    expect(source).toContain('fill="#269"');
  });
});

describe("overlay layer", () => {
  // Why not a lint rule: the invariant is a count across two places — the
  // shared overlay module spells `z-50` once (theming.md §7.4) and no
  // component restates it (popover.md §8.4). A lint rule banning the class
  // would need a per-file exemption for exactly the module that owns it, and
  // could not assert the "exactly once" half.
  it("is declared once in overlay-classes.ts and nowhere else in component source", () => {
    const overlayClasses = readSrc("components/overlay/overlay-classes.ts");
    expect(overlayClasses.match(/z-50/gu)).toHaveLength(1);
    expect(overlayClasses).toContain('export const overlayLayer = "z-50"');

    const owner = join(SRC_ROOT, "components/overlay/overlay-classes.ts");
    const restating = walkSourceFiles(SRC_ROOT)
      .filter((file) => file !== owner && readFileSync(file, "utf8").includes("z-50"))
      .map((file) => relative(SRC_ROOT, file));
    expect(restating).toEqual([]);
  }, 30_000);
});
