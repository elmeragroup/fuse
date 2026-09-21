import { describe, expect, it } from "vitest";

import { readDemoSource } from "../src/lib/demo-source";

describe("demo source read at render time (docs-site.md §6)", () => {
  it("reads the authored demo file verbatim", async () => {
    const demo = await readDemoSource("button", "button-variant-matrix.tsx");
    expect(demo.sourcePath).toBe(
      "apps/docs/src/app/(docs)/components/button/demos/button-variant-matrix.tsx"
    );
    expect(demo.source).toContain('"use client"');
    expect(demo.source).toContain('from "@elmeragroup/fuse/button"');
    expect(demo.source.endsWith("\n")).toBe(false);
  });

  it("throws with the path it looked for when the page names a demo that does not exist", async () => {
    await expect(readDemoSource("button", "button-no-such-demo.tsx")).rejects.toThrow(
      "apps/docs/src/app/(docs)/components/button/demos/button-no-such-demo.tsx does not exist"
    );
  });

  it("composes Table.Root in the frame-with-table demo", async () => {
    const demo = await readDemoSource("frame", "frame-with-table.tsx");
    expect(demo.source).toContain('from "@elmeragroup/fuse/table"');
    expect(demo.source).toContain("Table.Root");
    expect(demo.source).not.toContain("Table is not shipped");
  });
});
