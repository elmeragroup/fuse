import type { CSSProperties } from "react";

import { describe, expect, it } from "vitest";

// No themes.css: only themes.css declares the heading roles, so these headings see a host that
// declares none of them, or only the ones it sets itself.
import "../../../dist/styles.css";
import { render } from "../../../test/browser-render";
import { headingNamed, px } from "../../../test/themed-browser-render";
import { Heading } from "./heading";

const LEVELS = [1, 2, 3, 4] as const;

function LevelHeadings({ prefix, style }: { prefix: string; style?: CSSProperties }) {
  return (
    <div style={style}>
      {LEVELS.map((level) => (
        <Heading key={level} level={level}>{`${prefix} ${String(level)}`}</Heading>
      ))}
    </div>
  );
}

/** The computed size, line height and weight of a prefix's h1 to h4. */
function types(prefix: string): readonly { size: number; leading: number; weight: string }[] {
  return LEVELS.map((level) => {
    const style = getComputedStyle(headingNamed(`${prefix} ${String(level)}`, level));
    return { size: px(style.fontSize), leading: px(style.lineHeight), weight: style.fontWeight };
  });
}

describe("Heading scale and styles without themes.css", () => {
  it("keeps the level-free scale when the host sets no heading role", () => {
    render(<LevelHeadings prefix="Host" />);
    // text-2xl, text-lg and text-base at snug 1.375, all at 500.
    expect(types("Host")).toEqual([
      { size: 24, leading: 33, weight: "500" },
      { size: 18, leading: 24.75, weight: "500" },
      { size: 16, leading: 22, weight: "500" },
      { size: 16, leading: 22, weight: "500" },
    ]);
  });

  it("sets the scale from the host's own heading roles", () => {
    // The external heading styles, mapped by a host that keeps its own tokens.
    render(
      <LevelHeadings
        prefix="Mapped"
        style={{
          "--heading-1-size": "1.5rem",
          "--heading-1-leading": "2rem",
          "--heading-1-weight": "700",
          "--heading-2-size": "1.25rem",
          "--heading-2-leading": "2rem",
          "--heading-2-weight": "700",
          "--heading-3-size": "1.25rem",
          "--heading-3-leading": "2rem",
          "--heading-3-weight": "700",
        }}
      />
    );
    expect(types("Mapped")).toEqual([
      { size: 24, leading: 32, weight: "700" },
      { size: 20, leading: 32, weight: "700" },
      { size: 20, leading: 32, weight: "700" },
      { size: 16, leading: 22, weight: "500" },
    ]);
  });

  it("keeps the internal named styles when the host sets no heading role", () => {
    render(
      <div>
        <Heading typography="large">Host large</Heading>
        <Heading typography="medium">Host medium</Heading>
        <Heading typography="small">Host small</Heading>
        <Heading typography="xsmall">Host xsmall</Heading>
      </div>
    );
    // text-4xl, text-3xl, text-2xl and text-lg at snug 1.375, all at 500.
    const typeOf = (name: string) => {
      const style = getComputedStyle(headingNamed(name, 2));
      return { size: px(style.fontSize), leading: px(style.lineHeight), weight: style.fontWeight };
    };
    expect(typeOf("Host large")).toEqual({ size: 36, leading: 49.5, weight: "500" });
    expect(typeOf("Host medium")).toEqual({ size: 30, leading: 41.25, weight: "500" });
    expect(typeOf("Host small")).toEqual({ size: 24, leading: 33, weight: "500" });
    expect(typeOf("Host xsmall")).toEqual({ size: 18, leading: 24.75, weight: "500" });
  });
});
