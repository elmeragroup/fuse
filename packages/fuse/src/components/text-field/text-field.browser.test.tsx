import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { renderThemed, textboxNamed, textNamed } from "../../../test/themed-browser-render";
import { TextField } from "./text-field";

describe("TextField label wiring", () => {
  it("keeps the Field label when a wrapper forwards id and aria-labelledby as undefined", () => {
    renderThemed(<TextField label="Email" id={undefined} aria-labelledby={undefined} />);
    const input = textboxNamed("Email");
    const labelId = textNamed("Email").id;
    expect(labelId).not.toBe("");
    expect(input.getAttribute("aria-labelledby")).toBe(labelId);
  });
});
