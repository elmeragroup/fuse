import { describe, expect, it } from "vitest";

import { readDemoSource } from "../src/lib/demo-source";

describe("demo source read at render time", () => {
  it("reads the authored demo file verbatim", async () => {
    const demo = await readDemoSource({
      section: "components",
      slug: "button",
      file: "button-variant-matrix.tsx",
    });
    expect(demo.sourcePath).toBe(
      "apps/docs/src/app/(docs)/components/button/demos/button-variant-matrix.tsx"
    );
    expect(demo.source).toContain('"use client"');
    expect(demo.source).toContain('from "@elmeragroup/fuse/button"');
    expect(demo.source.endsWith("\n")).toBe(false);
  });

  it("throws with the path it looked for when the page names a demo that does not exist", async () => {
    await expect(
      readDemoSource({ section: "components", slug: "button", file: "button-no-such-demo.tsx" })
    ).rejects.toThrow(
      "apps/docs/src/app/(docs)/components/button/demos/button-no-such-demo.tsx does not exist"
    );
  });
});
