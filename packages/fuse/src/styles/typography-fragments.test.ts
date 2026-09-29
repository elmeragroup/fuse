import { describe, expect, it } from "vitest";

import { typographyFragments } from "./typography-fragments";

describe("typographyFragments", () => {
  it.each([
    // Each colour variant maps onto its role token.
    [{ variant: "default" }, "text-inherit"],
    [{ variant: "foreground" }, "text-foreground"],
    [{ variant: "primary" }, "text-primary"],
    [{ variant: "secondary" }, "text-foreground"],
    [{ variant: "brand" }, "text-brand"],
    [{ variant: "muted" }, "text-muted-foreground"],
    [{ variant: "inherit" }, "text-inherit"],
    [{ variant: "destructive" }, "text-error"],
    // Start, center and end alignment.
    [{ align: "left" }, "text-left"],
    [{ align: "center" }, "text-center"],
    [{ align: "right" }, "text-right"],
  ] as const)("maps %j to %s", (props, expected) => {
    expect(typographyFragments(props)).toBe(expected);
  });
});
