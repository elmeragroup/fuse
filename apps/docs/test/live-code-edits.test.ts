import { describe, expect, it } from "vitest";

import { editedSource } from "../src/lib/live-code/edits";
import type { FrameEdits, PropValue } from "../src/lib/live-code/edits";
import { findSites } from "../src/lib/live-code/sites";

const SOURCE = [
  'import { Button } from "@elmeragroup/fuse/button";',
  "",
  "export function Demo() {",
  "  return (",
  "    <>",
  '      <Button variant="outline" disabled>Save</Button>',
  "      <Button isPending={pending} />",
  "    </>",
  "  );",
  "}",
].join("\n");

function edits(entries: Record<string, Record<string, PropValue>>): FrameEdits {
  return new Map(Object.entries(entries).map(([loc, props]) => [loc, new Map(Object.entries(props))]));
}

/** The two Button lines of the edited source, which every case changes. */
function buttons(source: string): string[] {
  return source.split("\n").slice(5, 7);
}

describe("Live code serializer", () => {
  it("returns the source unchanged without edits", () => {
    expect(editedSource(SOURCE, findSites(SOURCE), new Map())).toBe(SOURCE);
  });

  it("rewrites written values, writing false out so a true default cannot come back", () => {
    const out = editedSource(
      SOURCE,
      findSites(SOURCE),
      edits({ "6:7": { variant: "ghost", disabled: false } })
    );
    expect(buttons(out)).toEqual([
      '      <Button variant="ghost" disabled={false}>Save</Button>',
      "      <Button isPending={pending} />",
    ]);
  });

  it("adds unwritten props after the tag name, in edit order, false included", () => {
    const out = editedSource(
      SOURCE,
      findSites(SOURCE),
      edits({ "7:7": { size: "sm", isPending: true, isVisuallyDisabled: false } })
    );
    expect(buttons(out)[1]).toBe('      <Button size="sm" isVisuallyDisabled={false} isPending />');
  });

  it("adds props after the tag's type arguments", () => {
    const source = [
      'import { Select } from "@elmeragroup/fuse/select";',
      "<Select.Root<Status> items={items}>",
      "</Select.Root>",
    ].join("\n");
    const out = editedSource(source, findSites(source), edits({ "2:1": { multiple: true } }));
    expect(out.split("\n")[1]).toBe("<Select.Root<Status> multiple items={items}>");
  });

  it("writes an override after the last spread, which would otherwise win, moving a written prop there", () => {
    // Oracle: JSX applies attributes left to right, so only an attribute after `{...props}` wins.
    const source = [
      'import { Button } from "@elmeragroup/fuse/button";',
      '<Button variant="ghost" {...props} disabled>Go</Button>',
    ].join("\n");
    const out = editedSource(
      source,
      findSites(source),
      edits({ "2:1": { size: "lg", variant: "outline", disabled: false } })
    );
    expect(out.split("\n")[1]).toBe(
      '<Button {...props} size="lg" variant="outline" disabled={false}>Go</Button>'
    );
  });
});
