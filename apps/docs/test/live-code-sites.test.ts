import { describe, expect, it } from "vitest";

import { findSites, readLensedImports } from "../src/lib/live-code/sites";

/** The text of a source range, so expectations read as the code they point at. */
function text(source: string, range: { start: number; end: number }): string {
  return source.slice(range.start, range.end);
}

describe("Live code site reader", () => {
  it("reads the lensed imports, leaving out type imports, icons, nested icon entries and theme", () => {
    const source = [
      'import { Button, type ButtonProps } from "@elmeragroup/fuse/button";',
      'import { Select as Picker } from "@elmeragroup/fuse/select";',
      'import { Plus } from "@elmeragroup/fuse/icons";',
      'import { ThemeScope } from "@elmeragroup/fuse/theme";',
      'import { DatePickerField } from "@elmeragroup/fuse/date-picker";',
      'import { BrandLogo } from "@elmeragroup/fuse/icons/brand";',
    ].join("\n");
    expect(readLensedImports(source).map(({ module, imports }) => ({ module, imports }))).toEqual([
      { module: "@elmeragroup/fuse/button", imports: [{ imported: "Button", local: "Button" }] },
      { module: "@elmeragroup/fuse/select", imports: [{ imported: "Select", local: "Picker" }] },
      {
        module: "@elmeragroup/fuse/date-picker",
        imports: [{ imported: "DatePickerField", local: "DatePickerField" }],
      },
    ]);
  });

  it("finds each site with its line:column, its part name and its attributes", () => {
    const source = [
      'import { Button } from "@elmeragroup/fuse/button";',
      "",
      "export function Demo() {",
      '  return <Button variant="outline" disabled size={size}>Save</Button>;',
      "}",
    ].join("\n");
    const [site] = findSites(source);
    expect(site?.loc).toBe("4:10");
    expect(site?.part).toBe("Button");
    expect(text(source, site?.tag ?? { start: 0, end: 0 })).toBe("Button");
    expect(
      site?.attributes.map((attribute) => ({
        name: attribute.name,
        written: text(source, attribute),
        value: attribute.value?.kind === "string" ? attribute.value.text : (attribute.value?.kind ?? null),
      }))
    ).toEqual([
      { name: "variant", written: 'variant="outline"', value: "outline" },
      { name: "disabled", written: "disabled", value: null },
      { name: "size", written: "size={size}", value: "expression" },
    ]);
  });

  it("reads a self-closing tag, skips spreads and comments, and steps over braces inside expressions", () => {
    const source = [
      'import { Button } from "@elmeragroup/fuse/button";',
      "const a = (",
      "  <Button",
      "    {...rest}",
      "    {/* a comment with a } brace */}",
      '    render={<a href="/x" title={`a ${"}"} b`} />}',
      "    isPending",
      "  />",
      ");",
    ].join("\n");
    const [site] = findSites(source);
    expect(site?.attributes.map((attribute) => text(source, attribute))).toEqual([
      'render={<a href="/x" title={`a ${"}"} b`} />}',
      "isPending",
    ]);
  });

  it("names a namespace's nested parts, through an `as` alias", () => {
    const source = [
      'import { Select as Picker } from "@elmeragroup/fuse/select";',
      "<Picker.Root>",
      '  <Picker.Trigger size="sm" />',
      "  <Picker.Item.Indicator />",
      "</Picker.Root>",
    ].join("\n");
    expect(findSites(source).map((site) => [site.loc, site.part])).toEqual([
      ["2:1", "Select.Root"],
      ["3:3", "Select.Trigger"],
      ["4:3", "Select.Item.Indicator"],
    ]);
  });

  it("skips a tag in a comment, a closing tag, and a name that only starts like an import", () => {
    const source = [
      'import { Button } from "@elmeragroup/fuse/button";',
      '// <Button variant="ghost">',
      "/* <Button /> */",
      "<ButtonGroup><Button>Go</Button></ButtonGroup>",
    ].join("\n");
    expect(findSites(source).map((site) => site.loc)).toEqual(["4:14"]);
  });

  it("steps over a tag's type arguments, nested brackets and arrows included, before its attributes", () => {
    const source = [
      'import { Select } from "@elmeragroup/fuse/select";',
      'import { Form } from "@elmeragroup/fuse/form";',
      "<Select.Root<StatusFilter> multiple items={items}>",
      '<Form<{ phone: string; onDone: (value: Map<string, number>) => void }> layout="stacked">',
    ].join("\n");
    const sites = findSites(source);
    expect(
      sites.map((site) => ({
        part: site.part,
        typeArguments: site.typeArguments === null ? null : text(source, site.typeArguments),
        insertAfter: source.slice(site.tag.start, site.insertAt),
        attributes: site.attributes.map((attribute) => attribute.name),
      }))
    ).toEqual([
      {
        part: "Select.Root",
        typeArguments: "<StatusFilter>",
        insertAfter: "Select.Root<StatusFilter>",
        attributes: ["multiple", "items"],
      },
      {
        part: "Form",
        typeArguments: "<{ phone: string; onDone: (value: Map<string, number>) => void }>",
        insertAfter: "Form<{ phone: string; onDone: (value: Map<string, number>) => void }>",
        attributes: ["layout"],
      },
    ]);
  });

  it("records spreads and puts the insertion point after the last one", () => {
    const source = [
      'import { Button } from "@elmeragroup/fuse/button";',
      '<Button variant="ghost" {...first} {/* note */} {...second} size="sm" />',
    ].join("\n");
    const [site] = findSites(source);
    expect(site?.spreads.map((spread) => text(source, spread))).toEqual(["{...first}", "{...second}"]);
    expect(source.slice(0, site?.insertAt).endsWith("{...second}")).toBe(true);
  });
});
