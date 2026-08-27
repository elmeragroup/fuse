import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "../../components/button/button-variants";
import { checkboxVariants } from "./checkbox";
import { fieldGroupVariants } from "./field";
import {
  OVERLAY_CONTAINER_ATTR,
  OVERLAY_CONTAINER_POPOVER,
  OVERLAY_CONTAINER_POPOVER_SELECTOR,
} from "./overlay-container";
import { composeTailwindRenderProps } from "./utils";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

function source(name: string): string {
  return readFileSync(join(here, name), "utf8");
}

describe("OVERLAY_CONTAINER_ATTR", () => {
  it("locks the attribute/value pair from date-picker.md §6", () => {
    expect(OVERLAY_CONTAINER_ATTR).toBe("data-overlay-container");
    expect(OVERLAY_CONTAINER_POPOVER).toBe("popover");
  });

  it("derives the modal's closest() selector from the same pair", () => {
    expect(OVERLAY_CONTAINER_POPOVER_SELECTOR).toBe(
      `[${OVERLAY_CONTAINER_ATTR}="${OVERLAY_CONTAINER_POPOVER}"]`
    );
  });

  it("is consumed by both the private popover and the private modal", () => {
    expect(source("popover.tsx")).toContain("OVERLAY_CONTAINER_ATTR");
    expect(source("popover.tsx")).toContain("OVERLAY_CONTAINER_POPOVER");
    expect(source("modal.tsx")).toContain("OVERLAY_CONTAINER_POPOVER_SELECTOR");
  });

  it("leaves no hardcoded DOM string on either side of the seam", () => {
    // The reference hardcoded `[data-overlay-container="popover"]` in both modules; the
    // locked ruling replaced both with the shared constants. Only the constant module
    // may spell the raw attribute name.
    for (const name of ["popover.tsx", "modal.tsx"]) {
      expect(source(name)).not.toContain("data-overlay-container");
    }
  });
});

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

  it("uses the input-surface token, not the reference's bg-background (§8.9)", () => {
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

describe("the internal RAC Button", () => {
  it("borrows the public buttonVariants recipe by relative import", () => {
    const button = source("button.tsx");
    expect(button).toContain('from "../../components/button/button-variants"');
    expect(button).toContain("buttonVariants({ variant, size })");
    // Never through the public specifier — the interim tier is package-private.
    expect(button).not.toContain("@elmeragroup/ui/button");
  });

  it("inherits Button's density ladder rather than restating metrics", () => {
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-(--control-h-sm)");
  });

  it("composes its render-prop className through the shared helper", () => {
    expect(source("button.tsx")).toContain("composeTailwindRenderProps");
  });
});

describe("the shared overlay class vocabulary", () => {
  it("borrows the layer and size axis instead of restating them (dialog.md §4, §8.4)", () => {
    for (const name of ["modal.tsx", "popover.tsx"]) {
      expect(source(name), name).toContain('from "../../components/overlay/overlay-classes"');
      // The z-50 layer is declared once, in the shared module, never here.
      expect(source(name), name).not.toContain("z-50");
    }
    expect(source("modal.tsx")).toContain("overlaySizeClasses");
    expect(source("modal.tsx")).not.toContain("--container-sm");
  });

  it("borrows the backdrop scrim instead of restating it (dialog.md §5)", () => {
    const modal = source("modal.tsx");
    expect(modal).toContain("overlayScrimClass");
    // The allowlisted `bg-black/10` literal is spelled only in the shared module.
    expect(modal).not.toContain("bg-black/10");
    expect(modal).not.toContain("backdrop-blur-xs");
  });

  it("borrows the public Dialog's heading and footer literals", () => {
    const dialog = source("dialog.tsx");
    expect(dialog).toContain("overlayTitleClass");
    expect(dialog).toContain("overlayFooterClass");
    expect(dialog).not.toContain("font-heading leading-none");
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
      "./react-aria/range-calendar",
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
    expect(catalog).toContain("react-aria-components: 1.19.0");
    expect(catalog).toContain("react-aria: 3.50.0");
    expect(catalog).toContain('"@internationalized/date": ^3.12.2');
  });
});
