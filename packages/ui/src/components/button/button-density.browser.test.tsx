import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { ThemeScope } from "../../theme";
import { Button } from "./button";

const fkasPrivate = { variant: "internal", brand: "fkas", segment: "private" } as const;
const fkasExternal = { variant: "external", brand: "fkas", segment: "private" } as const;

const cleanups: Array<() => void> = [];

const BOX = {
  dense: {
    xs: { height: 24, px: 8, icon: 6, gap: 4 },
    sm: { height: 32, px: 10, icon: 6, gap: 4 },
    md: { height: 36, px: 10, icon: 8, gap: 6 },
    lg: { height: 40, px: 10, icon: 8, gap: 6 },
  },
  comfortable: {
    xs: { height: 32, px: 12, icon: 10, gap: 6 },
    sm: { height: 36, px: 14, icon: 10, gap: 6 },
    md: { height: 44, px: 14, icon: 12, gap: 8 },
    lg: { height: 48, px: 14, icon: 12, gap: 8 },
  },
} as const;

const TYPE = {
  dense: { font: 14, leading: 20 },
  comfortable: { font: 18, leading: 24 },
} as const;

type Density = keyof typeof BOX;
type TextSize = "xs" | "sm" | "default" | "lg";
type IconSize = "icon-xs" | "icon-sm" | "icon" | "icon-lg";
type Rung = keyof (typeof BOX)["dense"];

const TEXT_TO_RUNG = {
  xs: "xs",
  sm: "sm",
  default: "md",
  lg: "lg",
} as const satisfies Record<TextSize, Rung>;

const ICON_TO_RUNG = {
  "icon-xs": "xs",
  "icon-sm": "sm",
  icon: "md",
  "icon-lg": "lg",
} as const satisfies Record<IconSize, Rung>;

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
  document.documentElement.removeAttribute("data-density");
  document.documentElement.style.removeProperty("font-size");
});

function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => {
    root.render(<ThemeScope theme={fkasPrivate}>{node}</ThemeScope>);
  });
  const unmount = () => {
    flushSync(() => {
      root.unmount();
    });
    host.remove();
  };
  cleanups.push(unmount);
  return { host, unmount };
}

function stampDensity(density: Density): void {
  document.documentElement.setAttribute("data-density", density);
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a pixel length, received ${value}`);
  }
  return parsed;
}

function gap(style: CSSStyleDeclaration): number {
  const value = style.columnGap === "" || style.columnGap === "normal" ? style.gap : style.columnGap;
  return px(value);
}

function measureText(name: string) {
  const style = getComputedStyle(buttonNamed(name));
  return {
    height: px(style.height),
    px: px(style.paddingInlineStart),
    gap: gap(style),
    font: px(style.fontSize),
    leading: px(style.lineHeight),
  };
}

function measureIconEdge(name: string) {
  return px(getComputedStyle(buttonNamed(name)).paddingInlineStart);
}

function measureIconEdgeEnd(name: string) {
  return px(getComputedStyle(buttonNamed(name)).paddingInlineEnd);
}

function measureSquare(name: string) {
  const style = getComputedStyle(buttonNamed(name));
  return { height: px(style.height), width: px(style.width) };
}

function textFixture(density: Density) {
  return (
    <>
      <Button size="xs" aria-label={`xs ${density}`}>
        <span>A</span>
        <span>B</span>
      </Button>
      <Button size="sm" aria-label={`sm ${density}`}>
        <span>A</span>
        <span>B</span>
      </Button>
      <Button size="default" aria-label={`default ${density}`}>
        <span>A</span>
        <span>B</span>
      </Button>
      <Button size="lg" aria-label={`lg ${density}`}>
        <span>A</span>
        <span>B</span>
      </Button>
      <Button size="xs" aria-label={`xs icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Button>
      <Button size="sm" aria-label={`sm icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Button>
      <Button size="default" aria-label={`default icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Button>
      <Button size="lg" aria-label={`lg icon ${density}`}>
        <span data-icon="inline-start" aria-hidden>
          *
        </span>
        Label
      </Button>
      <Button size="xs" aria-label={`xs icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Button>
      <Button size="sm" aria-label={`sm icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Button>
      <Button size="default" aria-label={`default icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Button>
      <Button size="lg" aria-label={`lg icon-end ${density}`}>
        Label
        <span data-icon="inline-end" aria-hidden>
          *
        </span>
      </Button>
      <Button size="icon-xs" aria-label={`icon-xs ${density}`} />
      <Button size="icon-sm" aria-label={`icon-sm ${density}`} />
      <Button size="icon" aria-label={`icon ${density}`} />
      <Button size="icon-lg" aria-label={`icon-lg ${density}`} />
    </>
  );
}

describe("Button density metrics", () => {
  it("resolves signed box and type metrics for every mapped rung at both densities", () => {
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      render(textFixture(density));

      for (const size of ["xs", "sm", "default", "lg"] as const) {
        const expected = BOX[density][TEXT_TO_RUNG[size]];
        const box = measureText(`${size} ${density}`);
        expect(box.height, `${density} ${size} height`).toBe(expected.height);
        expect(box.px, `${density} ${size} padding`).toBe(expected.px);
        expect(box.gap, `${density} ${size} gap`).toBe(expected.gap);
        expect(measureIconEdge(`${size} icon ${density}`), `${density} ${size} icon-edge`).toBe(
          expected.icon
        );
        expect(measureIconEdgeEnd(`${size} icon-end ${density}`), `${density} ${size} icon-edge-end`).toBe(
          expected.icon
        );
      }

      for (const size of ["icon-xs", "icon-sm", "icon", "icon-lg"] as const) {
        const expected = BOX[density][ICON_TO_RUNG[size]];
        const square = measureSquare(`${size} ${density}`);
        expect(square.height, `${density} ${size} height`).toBe(expected.height);
        expect(square.width, `${density} ${size} width`).toBe(expected.height);
      }

      const defaults = measureText(`default ${density}`);
      const large = measureText(`lg ${density}`);
      expect(defaults.font, `${density} default font`).toBe(TYPE[density].font);
      expect(defaults.leading, `${density} default leading`).toBe(TYPE[density].leading);
      expect(large.font, `${density} lg font`).toBe(TYPE[density].font);
      expect(large.leading, `${density} lg leading`).toBe(TYPE[density].leading);
    }
  });

  it("keeps xs and sm type identical across densities", () => {
    stampDensity("dense");
    render(
      <>
        <Button size="xs">xs dense type</Button>
        <Button size="sm">sm dense type</Button>
      </>
    );
    const denseXs = measureText("xs dense type");
    const denseSm = measureText("sm dense type");

    stampDensity("comfortable");
    render(
      <>
        <Button size="xs">xs comfortable type</Button>
        <Button size="sm">sm comfortable type</Button>
      </>
    );
    const comfortableXs = measureText("xs comfortable type");
    const comfortableSm = measureText("sm comfortable type");

    expect(comfortableXs.font).toBe(denseXs.font);
    expect(comfortableXs.leading).toBe(denseXs.leading);
    expect(comfortableSm.font).toBe(denseSm.font);
    expect(comfortableSm.leading).toBe(denseSm.leading);
  });

  it("lets comfortable differ on every density-owned metric", () => {
    stampDensity("dense");
    render(
      <>
        <Button aria-label="dense default">
          <span>A</span>
          <span>B</span>
        </Button>
        <Button aria-label="dense default icon">
          <span data-icon="inline-start" aria-hidden>
            *
          </span>
          Label
        </Button>
      </>
    );
    const dense = measureText("dense default");
    const denseIcon = measureIconEdge("dense default icon");

    stampDensity("comfortable");
    render(
      <>
        <Button aria-label="comfortable default">
          <span>A</span>
          <span>B</span>
        </Button>
        <Button aria-label="comfortable default icon">
          <span data-icon="inline-start" aria-hidden>
            *
          </span>
          Label
        </Button>
      </>
    );
    const comfortable = measureText("comfortable default");

    expect(comfortable.height).not.toBe(dense.height);
    expect(comfortable.px).not.toBe(dense.px);
    expect(comfortable.gap).not.toBe(dense.gap);
    expect(comfortable.font).not.toBe(dense.font);
    expect(comfortable.leading).not.toBe(dense.leading);
    expect(measureIconEdge("comfortable default icon")).not.toBe(denseIcon);
  });

  it("does not rescope metrics from a nested data-density or ThemeScope variant change", () => {
    stampDensity("dense");
    render(
      <div data-density="comfortable">
        <Button>nested</Button>
      </div>
    );
    expect(measureText("nested").height).toBe(BOX.dense.md.height);

    render(
      <ThemeScope theme={fkasExternal}>
        <Button>scoped</Button>
      </ThemeScope>
    );
    expect(measureText("scoped").height).toBe(BOX.dense.md.height);
  });

  it("keeps icon-inline geometry independent of density", () => {
    stampDensity("dense");
    render(<Button size="icon-inline" aria-label="inline dense" />);
    const dense = measureSquare("inline dense");

    stampDensity("comfortable");
    render(<Button size="icon-inline" aria-label="inline comfortable" />);
    const comfortable = measureSquare("inline comfortable");

    expect(comfortable.height).toBe(dense.height);
    expect(comfortable.width).toBe(dense.width);
  });

  it("meets the 24px target-size minimum on the smallest square rung at each density", () => {
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      render(<Button size="icon-xs" aria-label={`smallest ${density}`} />);
      const square = measureSquare(`smallest ${density}`);
      expect(square.height).toBeGreaterThanOrEqual(24);
      expect(square.width).toBeGreaterThanOrEqual(24);
    }
  });
});
