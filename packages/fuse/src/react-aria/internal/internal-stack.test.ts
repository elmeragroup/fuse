import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "../../components/button/button-variants";
import { fieldBox, fieldBoxChromeClass, numberFieldGroupClass } from "../../styles/field-box";
import { checkboxVariants } from "./checkbox";
import { composeTailwindRenderProps } from "./compose-tailwind-render-props";
import { fieldGroupVariants } from "./field";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

type HoverState = { isHovered: boolean };

function resolveClassName(
  composed: string | ((renderProps: HoverState) => string),
  renderProps: HoverState
): string {
  return composed instanceof Function ? composed(renderProps) : composed;
}

describe("composeTailwindRenderProps", () => {
  it("merges the recipe classes underneath a plain string", () => {
    const composed = composeTailwindRenderProps<HoverState>("px-8", "px-2 rounded-md");
    expect(resolveClassName(composed, { isHovered: false })).toBe("rounded-md px-8");
  });

  it("resolves the render-prop function form before merging", () => {
    const composed = composeTailwindRenderProps<HoverState>(
      (renderProps) => (renderProps.isHovered ? "px-8" : ""),
      "px-2"
    );
    expect(resolveClassName(composed, { isHovered: true })).toBe("px-8");
    expect(resolveClassName(composed, { isHovered: false })).toBe("px-2");
  });
});

describe("fieldGroupVariants", () => {
  it("pins the md control rung instead of the reference's literal h-9", () => {
    const classes = fieldGroupVariants();
    expect(classes).toContain("h-(--control-h-md)");
    expect(classes).not.toContain("h-9");
  });

  it("does not grow a size axis for density (conventions ruling 2)", () => {
    expect(fieldGroupVariants.variantKeys).not.toContain("size");
  });

  it("uses the input-surface token, not the reference's bg-background", () => {
    expect(fieldGroupVariants()).toContain("bg-card");
    expect(fieldGroupVariants()).not.toContain("bg-background");
  });

  it("paints the shared focus ring only while focus is visible", () => {
    expect(fieldGroupVariants({ isFocusVisible: false })).not.toContain("ring-ring");
    expect(fieldGroupVariants({ isFocusVisible: true })).toContain("ring-ring");
  });

  it("marks invalid and read-only state with role tokens", () => {
    expect(fieldGroupVariants({ isInvalid: true })).toContain("border-error");
    expect(fieldGroupVariants({ isReadOnly: true })).toContain("bg-muted");
  });
});

describe("field-box chrome parity", () => {
  // Unit under test: each field box's merged classes. Oracle: the shared chrome they
  // compose, whose tokens field-box.test.ts pins by hand. A consumer class that cancels a
  // chrome token in the merge fails here.
  const tokens = fieldBoxChromeClass.split(" ");

  it("lands every shared chrome token on every field box's computed output", () => {
    const racBox = fieldGroupVariants().split(" ");
    const baseUiBox = fieldBox({ box: "control" }).split(" ");
    const numberFieldBox = numberFieldGroupClass.split(" ");
    for (const token of tokens) {
      expect(racBox, `interim tier lost ${token}`).toContain(token);
      expect(baseUiBox, `base-ui tier lost ${token}`).toContain(token);
      expect(numberFieldBox, `NumberField group lost ${token}`).toContain(token);
    }
  });

  it("leaves no field box a second radius or elevation rung to drift on", () => {
    for (const rendered of [fieldGroupVariants(), fieldBox({ box: "control" }), numberFieldGroupClass]) {
      expect(rendered.match(/(?:^|\s)rounded-\S+/gu)).toHaveLength(1);
      expect(rendered.match(/(?:^|\s)shadow-\S+/gu)).toHaveLength(1);
    }
  });
});

describe("internal Button consumers", () => {
  it("inherit Button's density ladder rather than restating metrics", () => {
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-(--control-h-sm)");
  });
});

describe("checkboxVariants", () => {
  it("keeps the private recipe on role tokens after retokenization", () => {
    const { base, box, icon } = checkboxVariants({ isSelected: true });
    const rendered = `${base()} ${box()} ${icon()}`;
    expect(rendered).not.toContain("theme(colors");
    expect(rendered).not.toContain("destructive");
    expect(rendered).toContain("var(--primary)");
  });

  it("swaps the reference's destructive vocabulary for error", () => {
    expect(checkboxVariants({ isInvalid: true }).box()).toContain("var(--error)");
  });
});

type ExportTarget = string | { types: string; import: string };

describe("Wave 4 gate: zero public surface", () => {
  // SAFETY: the package's own generated manifest — the exports codegen owns this shape,
  // and the assertions below fail loudly if it ever stops matching.
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    exports: Record<string, ExportTarget>;
    dependencies: Record<string, string>;
  };

  it("publishes only the shipped react-aria/* entries and never internals", () => {
    const racKeys = Object.keys(manifest.exports).filter((key) => key.startsWith("./react-aria"));
    expect(racKeys).toEqual([
      "./react-aria/calendar",
      "./react-aria/date-field",
      "./react-aria/date-picker",
      "./react-aria/date-range-picker",
      "./react-aria/file-trigger",
      "./react-aria/focusable",
      "./react-aria/grid-list",
      "./react-aria/link",
      "./react-aria/range-calendar",
      "./react-aria/search-field",
      "./react-aria/ui-providers",
    ]);
  });

  it("never exposes an internal module through a subpath", () => {
    for (const key of Object.keys(manifest.exports)) {
      expect(key).not.toContain("internal");
    }
  });

  it("has no barrel entry for the private stack", () => {
    const barrel = readFileSync(join(packageRoot, "src/index.ts"), "utf8");
    expect(barrel).not.toContain('from "./react-aria');
  });

  it("pins the RAC dependency trio through the catalog", () => {
    expect(manifest.dependencies["react-aria-components"]).toBe("catalog:");
    expect(manifest.dependencies["react-aria"]).toBe("catalog:");
    expect(manifest.dependencies["@internationalized/date"]).toBe("catalog:");
  });

  it("pins the exact versions in the workspace catalog", () => {
    const catalog = readFileSync(join(packageRoot, "../../pnpm-workspace.yaml"), "utf8");
    expect(catalog).toContain("react-aria-components: 1.21.1");
    expect(catalog).toContain("react-aria: 3.52.1");
    expect(catalog).toContain('"@internationalized/date": 3.12.4');
  });
});
