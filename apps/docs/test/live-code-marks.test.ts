import { describe, expect, it } from "vitest";

import { highlightLiveSource, highlightSource } from "../src/components/docs-code-block";
import { findSites } from "../src/lib/live-code/sites";
import { decodeHtml, tagAttribute } from "./html";

/** The marked tokens' text, joined per mark: `<loc> <role> <prop>` to the text it covers. */
function marked(html: string): Map<string, string> {
  const marks = new Map<string, string>();
  for (const span of html.matchAll(/(<span [^>]*data-lens-site[^>]*>)([^<]*)<\/span>/gu)) {
    const open = span[1] ?? "";
    const key = [
      tagAttribute(open, "data-lens-site"),
      tagAttribute(open, "data-lens-role"),
      tagAttribute(open, "data-lens-prop") ?? "",
    ]
      .join(" ")
      .trim();
    marks.set(key, (marks.get(key) ?? "") + decodeHtml(span[2] ?? ""));
  }
  return marks;
}

describe("Live code token marks", () => {
  it("marks the tag name and each attribute's name and value, at the sites' own lines", () => {
    // Unit under test: the offsets rebuilt from sugar-high's token values. Oracle: the source text
    // at each site's ranges, which the marked tokens must spell out.
    const source = [
      '"use client";',
      "",
      'import { Button } from "@elmeragroup/fuse/button";',
      "",
      "export function Demo() {",
      '  const label = "Save — ✓ 😀";',
      "  return (",
      '    <Button variant="outline" isPending size={size}>',
      "      {label}",
      "    </Button>",
      "  );",
      "}",
    ].join("\n");
    const marks = marked(highlightLiveSource(source, findSites(source)));
    expect(Object.fromEntries(marks)).toEqual({
      "8:5 tag": "Button",
      "8:5 name variant": "variant=",
      "8:5 value variant": '"outline"',
      "8:5 name isPending": "isPending",
      "8:5 name size": "size=",
      "8:5 value size": "{size}",
    });
  });

  it("leaves the highlighted markup itself as the plain highlighter writes it", () => {
    const source = 'import { Button } from "@elmeragroup/fuse/button";\n<Button variant="ghost" />';
    const strip = (html: string): string => html.replace(/ data-lens-[a-z]+="[^"]*"/gu, "");
    expect(strip(highlightLiveSource(source, findSites(source)))).toBe(highlightSource(source));
  });

  it("gives a part written inside another part's attribute its own marks, and marks type arguments", () => {
    const source = [
      'import { Button } from "@elmeragroup/fuse/button";',
      'import { Popover } from "@elmeragroup/fuse/popover";',
      '<Popover.Trigger render={<Button variant="outline" />} />',
      "<Popover.Root<string> open>",
    ].join("\n");
    const marks = marked(highlightLiveSource(source, findSites(source)));
    expect(marks.get("3:26 tag")).toBe("Button");
    expect(marks.get("3:26 value variant")).toBe('"outline"');
    expect(marks.get("3:1 tag")).toBe("Popover.Trigger");
    expect(marks.get("4:1 type")).toBe("<string>");
    const spread = 'import { Button } from "@elmeragroup/fuse/button";\n<Button {...props} />';
    expect(marked(highlightLiveSource(spread, findSites(spread))).get("2:1 spread")).toBe("{...props}");
  });
});
