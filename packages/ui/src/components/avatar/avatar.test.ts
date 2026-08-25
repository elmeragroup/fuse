import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "avatar.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "avatar.ts"), "utf8");

const ROOT_CLASSES =
  "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle text-sm font-medium text-muted-foreground select-none";

describe("avatar source contract", () => {
  it("stays a client surface that emits data-slot before the props spread", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("bg-gray-");
    expect(source).not.toContain("text-gray-");
    expect(source).toContain("bg-muted");
    expect(source).toContain("text-muted-foreground");
    expect(source).toContain('displayName = "Avatar.Root"');
    expect(source).toContain('displayName = "Avatar.Image"');
    expect(source).toContain('displayName = "Avatar.Fallback"');
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("avatarVariants");
    expect(facade).not.toContain("AvatarRoot");
    expect(facade).not.toContain("AvatarProps");
    for (const slot of ["avatar", "avatar-image", "avatar-fallback"]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });

  it("is a namespace passthrough with the spec's token fill and no recipe", () => {
    expect(source).toContain(ROOT_CLASSES);
    expect(source).toContain("size-full object-cover");
    expect(source).toContain("flex size-full items-center justify-center");
    expect(source).toContain('from "@base-ui/react/avatar"');
    expect(source).toContain("ComponentProps");
    expect(source).not.toContain("avatarVariants");
    expect(source).not.toContain("HTMLAttributes");
    expect(facade).toContain('export { Avatar } from "./components/avatar/avatar";');
    expect(facade).not.toContain("avatarVariants");
  });
});

describe("avatar className merge", () => {
  it("lets size-10 beat the default size-8 through cn", () => {
    const merged = cn(ROOT_CLASSES, "size-10").split(/\s+/);
    expect(merged).toContain("size-10");
    expect(merged).not.toContain("size-8");
    expect(merged).toEqual(
      expect.arrayContaining(["inline-flex", "shrink-0", "rounded-full", "bg-muted", "text-muted-foreground"])
    );
  });
});
