import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  stampDensity,
} from "../../../test/themed-browser-render";
import type { Density } from "../../theme";
import { ThemeScope } from "../../theme";
import { Toggle } from "./toggle";

const BOX = {
  dense: {
    xs: { height: 24, px: 8, icon: 6, gap: 4 },
    sm: { height: 32, px: 10, icon: 6, gap: 4 },
    md: { height: CONTROL_MD.dense.height, px: CONTROL_MD.dense.px, icon: 8, gap: 6 },
    lg: { height: 40, px: 10, icon: 8, gap: 6 },
  },
  comfortable: {
    xs: { height: 32, px: 12, icon: 10, gap: 6 },
    sm: { height: 36, px: 14, icon: 10, gap: 6 },
    md: { height: CONTROL_MD.comfortable.height, px: CONTROL_MD.comfortable.px, icon: 12, gap: 8 },
    lg: { height: 48, px: 14, icon: 12, gap: 8 },
  },
} as const;

const TYPE = {
  dense: { font: CONTROL_MD.dense.font, leading: CONTROL_MD.dense.leading },
  comfortable: { font: CONTROL_MD.comfortable.font, leading: CONTROL_MD.comfortable.leading },
} as const;

type Size = "xs" | "sm" | "default" | "lg";
type Rung = keyof (typeof BOX)["dense"];

const SIZE_TO_RUNG = {
  xs: "xs",
  sm: "sm",
  default: "md",
  lg: "lg",
} as const satisfies Record<Size, Rung>;

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

function toggleNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML toggle named ${name}`);
  }
  return element;
}

function gap(style: CSSStyleDeclaration): number {
  const value = style.columnGap === "" || style.columnGap === "normal" ? style.gap : style.columnGap;
  return px(value);
}

function measureBox(name: string) {
  const style = getComputedStyle(toggleNamed(name));
  return {
    height: px(style.height),
    minWidth: px(style.minWidth),
    px: px(style.paddingInlineStart),
    gap: gap(style),
    font: px(style.fontSize),
    leading: px(style.lineHeight),
  };
}

function measureIconEdge(name: string) {
  return px(getComputedStyle(toggleNamed(name)).paddingInlineStart);
}

function measureIconEdgeEnd(name: string) {
  return px(getComputedStyle(toggleNamed(name)).paddingInlineEnd);
}

function fixture(density: Density) {
  return (
    <>
      <Toggle size="xs" aria-label={`xs ${density}`}>
        <span>A</span>
        <span>B</span>
      </Toggle>
      <Toggle size="sm" aria-label={`sm ${density}`}>
        <span>A</span>
        <span>B</span>
      </Toggle>
      <Toggle size="default" aria-label={`default ${density}`}>
        <span>A</span>
        <span>B</span>
      </Toggle>
      <Toggle size="lg" aria-label={`lg ${density}`}>
        <span>A</span>
        <span>B</span>
      </Toggle>
      <Toggle size="xs" aria-label={`xs icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Toggle>
      <Toggle size="sm" aria-label={`sm icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Toggle>
      <Toggle size="default" aria-label={`default icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Toggle>
      <Toggle size="lg" aria-label={`lg icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Toggle>
      <Toggle size="xs" aria-label={`xs icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Toggle>
      <Toggle size="sm" aria-label={`sm icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Toggle>
      <Toggle size="default" aria-label={`default icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Toggle>
      <Toggle size="lg" aria-label={`lg icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Toggle>
    </>
  );
}

describe("Toggle density metrics", () => {
  it("resolves signed box metrics for every mapped rung at both densities", () => {
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      renderThemed(fixture(density));

      for (const size of ["xs", "sm", "default", "lg"] as const) {
        const expected = BOX[density][SIZE_TO_RUNG[size]];
        const box = measureBox(`${size} ${density}`);
        expect(box.height, `${density} ${size} height`).toBe(expected.height);
        expect(box.minWidth, `${density} ${size} min-width`).toBe(expected.height);
        expect(box.px, `${density} ${size} padding`).toBe(expected.px);
        expect(box.gap, `${density} ${size} gap`).toBe(expected.gap);
        expect(measureIconEdge(`${size} icon ${density}`), `${density} ${size} icon-edge`).toBe(
          expected.icon
        );
        expect(measureIconEdgeEnd(`${size} icon-end ${density}`), `${density} ${size} icon-edge-end`).toBe(
          expected.icon
        );
      }

      const defaults = measureBox(`default ${density}`);
      const large = measureBox(`lg ${density}`);
      expect(defaults.font, `${density} default font`).toBe(TYPE[density].font);
      expect(defaults.leading, `${density} default leading`).toBe(TYPE[density].leading);
      expect(large.font, `${density} lg font`).toBe(TYPE[density].font);
      expect(large.leading, `${density} lg leading`).toBe(TYPE[density].leading);
    }
  });

  it("keeps xs and sm type identical across densities", () => {
    stampDensity("dense");
    renderThemed(
      <>
        <Toggle size="xs">xs dense type</Toggle>
        <Toggle size="sm">sm dense type</Toggle>
      </>
    );
    const denseXs = measureBox("xs dense type");
    const denseSm = measureBox("sm dense type");

    stampDensity("comfortable");
    renderThemed(
      <>
        <Toggle size="xs">xs comfortable type</Toggle>
        <Toggle size="sm">sm comfortable type</Toggle>
      </>
    );
    const comfortableXs = measureBox("xs comfortable type");
    const comfortableSm = measureBox("sm comfortable type");

    expect(comfortableXs.font).toBe(denseXs.font);
    expect(comfortableXs.leading).toBe(denseXs.leading);
    expect(comfortableSm.font).toBe(denseSm.font);
    expect(comfortableSm.leading).toBe(denseSm.leading);
  });

  it("does not rescope metrics from a nested data-density or ThemeScope variant change", () => {
    stampDensity("dense");
    renderThemed(
      <div data-density="comfortable">
        <Toggle>nested</Toggle>
      </div>
    );
    expect(measureBox("nested").height).toBe(BOX.dense.md.height);

    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Toggle>scoped</Toggle>
      </ThemeScope>
    );
    expect(measureBox("scoped").height).toBe(BOX.dense.md.height);
  });
});
