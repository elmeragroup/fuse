import { describe, expect, it } from "vitest";

import { definedProps } from "./defined-props";

describe("definedProps", () => {
  it("drops present-but-undefined keys and keeps every other value", () => {
    const onClick = () => "clicked";
    expect(
      definedProps({
        id: "app-sidebar",
        "aria-labelledby": undefined,
        "aria-describedby": undefined,
        role: undefined,
        "aria-hidden": false,
        tabIndex: 0,
        title: "",
        "aria-label": null,
        onClick,
      })
    ).toStrictEqual({
      id: "app-sidebar",
      "aria-hidden": false,
      tabIndex: 0,
      title: "",
      "aria-label": null,
      onClick,
    });
  });
});
