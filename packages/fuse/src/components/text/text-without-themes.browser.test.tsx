/* oxlint-disable fuse/one-browser-test-per-module -- a host without themes.css: the paragraph roles fall back when no theme declares them, and text.browser.test.tsx loads themes.css for its whole page */
import type { CSSProperties } from "react";

import { describe, expect, it } from "vitest";

// No themes.css: only themes.css declares the paragraph roles, so these Texts see a host that
// declares none of them, or only the ones it sets itself.
import "../../../dist/styles.css";
import { render } from "../../../test/browser-render";
import { px, textNamed } from "../../../test/themed-browser-render";
import { Text } from "./text";

const SIZES = ["sm", "default", "lg"] as const;

function SizedTexts({ prefix, style }: { prefix: string; style?: CSSProperties }) {
  return (
    <div style={style}>
      {SIZES.map((size) => (
        <Text key={size} size={size}>{`${prefix} ${size}`}</Text>
      ))}
    </div>
  );
}

/** The computed line heights of a prefix's sm, default and lg Texts, in px. */
function lineHeights(prefix: string): readonly number[] {
  return SIZES.map((size) => px(getComputedStyle(textNamed(`${prefix} ${size}`)).lineHeight));
}

describe("Text paragraph line height without themes.css", () => {
  it("keeps the relaxed line height when the host sets no paragraph role", () => {
    render(<SizedTexts prefix="Host" />);
    // relaxed 1.625 × 14, 16 and 18px.
    expect(lineHeights("Host")).toEqual([22.75, 26, 29.25]);
  });

  it("sets the line height from the host's own paragraph roles", () => {
    // The branded paragraph styles, mapped by a host that keeps its own tokens.
    render(
      <SizedTexts
        prefix="Mapped"
        style={{
          "--paragraph-leading-sm": "1.25rem",
          "--paragraph-leading-base": "1.375rem",
          "--paragraph-leading-lg": "1.5rem",
        }}
      />
    );
    expect(lineHeights("Mapped")).toEqual([20, 22, 24]);
  });
});
