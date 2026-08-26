import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CheckboxCard } from "./checkbox-card";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "checkbox-card.tsx"), "utf8");

describe("checkbox-card source contract", () => {
  it("keeps the internal render before the primitive spread and emits no data-slot", () => {
    expect(source).not.toContain(".ref/");
    const renderMarker = "render={(props, state) =>";
    const otherMarker = "{...other}";
    expect(source).toContain(renderMarker);
    expect(source).toContain(otherMarker);
    expect(source.indexOf(renderMarker)).toBeLessThan(source.indexOf(otherMarker));
    expect(source).not.toContain("data-slot");
  });
});

describe("CheckboxCard Field.Root requirement", () => {
  it("throws without a Field.Root ancestor", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(CheckboxCard, {
          title: "Insurance",
          description: "Covers everything.",
          value: "insurance",
        })
      )
    ).toThrow();
  });
});
