import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "file-trigger.tsx"), "utf8");
const facade = readFileSync(join(here, "../file-trigger.ts"), "utf8");

function primitiveOpenTag(text: string): string {
  const start = text.indexOf("<FileTriggerPrimitive");
  const end = text.indexOf(">", start);
  if (start === -1 || end === -1) {
    throw new Error("expected a FileTriggerPrimitive opening tag");
  }
  return text.slice(start, end);
}

describe("file-trigger source contract", () => {
  it("is a client module that never reaches for the reference or its own public specifier", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    expect(source).not.toContain("tv(");
  });

  it("keeps the facade a directive-free named re-export of FileTrigger and FileTriggerProps", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).toContain('export { FileTrigger } from "./file-trigger/file-trigger"');
    expect(facade).toContain('export type { FileTriggerProps } from "./file-trigger/file-trigger"');
  });

  it("does not fork a local button or reach for the public base-ui Button", () => {
    expect(source).not.toContain('from "./button"');
    expect(source).not.toContain('from "./utils"');
    expect(source).not.toContain('from "../../components/button/button"');
    expect(source).not.toContain("@elmeragroup/ui/button");
  });

  it("takes the glyphs from the Phosphor Camera, Folder, and Paperclip roster entries (§8.2)", () => {
    expect(source).toContain('from "../../icons/generated/camera"');
    expect(source).toContain('from "../../icons/generated/folder"');
    expect(source).toContain('from "../../icons/generated/paperclip"');
    expect(source).toContain("<Camera aria-hidden");
    expect(source).toContain("<Folder aria-hidden");
    expect(source).toContain("<Paperclip aria-hidden");
    expect(source).not.toContain("lucide");
  });

  it("routes variant, size, isDisabled, and className to the Button, not the primitive (§8.3)", () => {
    expect(source).toContain("variant={variant}");
    expect(source).toContain("size={size}");
    expect(source).toContain("isDisabled={isDisabled}");
    expect(source).toContain('className={cn(withIcon && "gap-x-2", className)}');

    const primitive = primitiveOpenTag(source);
    expect(primitive).not.toContain("variant=");
    expect(primitive).not.toContain("isDisabled=");
    expect(primitive).not.toContain("size=");
    expect(primitive).not.toContain("className=");
    expect(primitive).toContain("{...props}");
  });

  it("never emits a density override or a hardcoded field-box height", () => {
    expect(source).not.toContain("h-9");
    expect(source).not.toContain("data-density");
    expect(source).not.toContain("dense:");
    expect(source).not.toContain("comfortable:");
  });

  it("never uses primitive gray/white, destructive vocabulary, or a dark variant", () => {
    expect(source).not.toContain("text-gray-");
    expect(source).not.toContain("bg-gray-");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("text-white");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).not.toContain("destructive");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
  });
});

describe("file-trigger package surface", () => {
  it("is a subpath-only react-aria entry whose only value export is FileTrigger", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/file-trigger");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["FileTrigger"]);
    expect(entry?.sourceFile).toBe("src/react-aria/file-trigger.ts");
    expect(root?.runtimeExports).not.toContain("FileTrigger");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/file-trigger");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("file-trigger");
  }, 30_000);
});
