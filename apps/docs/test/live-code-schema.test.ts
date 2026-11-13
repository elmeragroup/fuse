import { describe, expect, it } from "vitest";

import { allowedValues, partSchema } from "../src/lib/live-code/schema";

describe("Live code schema", () => {
  // Oracle: Button's api.json rows, written out by hand: icon sizes need `aria-label`, and Button
  // destructures `size = "default"`.
  const [size, isPending] = partSchema([
    {
      name: "size",
      type: "IconButtonSize | LabelButtonSize | undefined",
      values: ["default", "icon", "lg"],
      requires: { icon: [["aria-label"]] },
      defaultValue: '"default"',
    },
    { name: "isPending", type: "boolean | undefined", defaultValue: "false" },
    { name: "className", type: "string | undefined", defaultValue: null },
  ]);

  it("reads enums with their requirements and authored default, and booleans with theirs", () => {
    expect(size).toEqual({
      name: "size",
      kind: "enum",
      values: ["default", "icon", "lg"],
      requires: { icon: [["aria-label"]] },
      default: "default",
    });
    expect(isPending).toEqual({ name: "isPending", kind: "boolean", default: false });
  });

  it("knows no default where the artifact records none, whatever the options are called", () => {
    // Oracle: Calendar.DecrementMonth renders `ghost`; its api.json `variant` row has no default,
    // so its option named `default` must not read as the value it renders.
    const [variant] = partSchema([
      {
        name: "variant",
        type: '"default" | "ghost" | undefined',
        values: ["default", "ghost"],
        defaultValue: null,
      },
    ]);
    expect(variant).toEqual({ name: "variant", kind: "enum", values: ["default", "ghost"] });
    if (variant?.kind !== "enum") throw new Error("variant is an enum");
    // With no value shown, every option stays on offer and none counts as current.
    expect(allowedValues(variant, new Set(), undefined)).toEqual(["default", "ghost"]);
  });

  it("offers a value only when the site passes the props it needs", () => {
    if (size?.kind !== "enum") throw new Error("size is an enum");
    expect(allowedValues(size, new Set(["variant"]), undefined)).toEqual(["default", "lg"]);
    expect(allowedValues(size, new Set(["aria-label"]), undefined)).toEqual(["default", "icon", "lg"]);
  });

  it("accepts any one alternative, and keeps the site's current value whatever it needs", () => {
    // Oracle: Carousel names its region with `aria-label` or `aria-labelledby`, and SkeletonReveal
    // reveals `data` or follows `loading`; a site passing either of a pair passes.
    const [orientation, reveal] = partSchema([
      {
        name: "orientation",
        type: '"horizontal" | "vertical" | undefined',
        values: ["horizontal", "vertical"],
        requires: {
          horizontal: [["aria-label"], ["aria-labelledby"]],
          vertical: [["aria-label"], ["aria-labelledby"]],
        },
        defaultValue: null,
      },
      {
        name: "reveal",
        type: '"sequence" | "smart" | undefined',
        values: ["sequence", "smart"],
        requires: { sequence: [["data"], ["loading"]], smart: [["data"], ["loading"]] },
        defaultValue: null,
      },
    ]);
    if (orientation?.kind !== "enum" || reveal?.kind !== "enum") throw new Error("both are enums");
    expect(allowedValues(orientation, new Set(["aria-label"]), undefined)).toEqual([
      "horizontal",
      "vertical",
    ]);
    expect(allowedValues(orientation, new Set(["aria-labelledby"]), undefined)).toEqual([
      "horizontal",
      "vertical",
    ]);
    expect(allowedValues(orientation, new Set(), undefined)).toEqual([]);
    expect(allowedValues(reveal, new Set(["data"]), "smart")).toEqual(["sequence", "smart"]);
    // A site that passes neither still lists the value it renders, so its submenu has an option.
    expect(allowedValues(reveal, new Set(), "smart")).toEqual(["smart"]);
  });

  it("leaves out props that swap the rendered element", () => {
    // Oracle: Text with children breaks as `elementType="input"`, as `render` would swap it.
    const specs = partSchema([
      {
        name: "elementType",
        type: '"p" | "span" | "input" | undefined',
        values: ["input", "p", "span"],
        defaultValue: null,
      },
      { name: "render", type: '"a" | "b" | undefined', values: ["a", "b"], defaultValue: null },
      { name: "size", type: '"sm" | "lg" | undefined', values: ["lg", "sm"], defaultValue: null },
    ]);
    expect(specs.map((spec) => spec.name)).toEqual(["size"]);
  });

  it("leaves out controlled state and reads nullable booleans", () => {
    // Oracle: PhoneNumberField's `countryCode` is the controlled twin of `defaultCountryCode`,
    // and DatePicker's `isOpen` is owned by the parent; a `boolean | null | undefined` prop is a
    // boolean the reader can set.
    const specs = partSchema([
      { name: "countryCode", type: '"NO" | "SE" | undefined', values: ["NO", "SE"], defaultValue: null },
      {
        name: "defaultCountryCode",
        type: '"NO" | "SE" | undefined',
        values: ["NO", "SE"],
        defaultValue: null,
      },
      { name: "isOpen", type: "boolean | undefined", defaultValue: null },
      { name: "isDisabled", type: "boolean | null | undefined", defaultValue: null },
    ]);
    expect(specs).toEqual([{ name: "isDisabled", kind: "boolean" }]);
  });
});
