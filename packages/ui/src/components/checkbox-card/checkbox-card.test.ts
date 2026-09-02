import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CheckboxCard } from "./checkbox-card";

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
