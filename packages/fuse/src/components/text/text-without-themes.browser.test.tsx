/* oxlint-disable fuse/one-browser-test-per-module -- these tests check token fallbacks without themes.css, and the main suite loads it for its whole page */
import type { CSSProperties } from "react";

import { describe, expect, it, onTestFinished } from "vitest";

// No themes.css: only themes.css declares the paragraph roles, so these Texts see a host that
// declares none of them, or only the ones it sets itself.
import "../../../dist/styles.css";
import { render } from "../../../test/browser-render";
import { consumerCss, STANDALONE_ENTRY } from "../../../test/tailwind-consumer-build";
import { layoutPx, textNamed } from "../../../test/themed-browser-render";
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

/** The laid-out line heights of a prefix's sm, default and lg Texts, in px. */
function lineHeights(prefix: string): readonly number[] {
  return SIZES.map((size) => layoutPx(getComputedStyle(textNamed(`${prefix} ${size}`)).lineHeight));
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

describe("Text brand color without themes.css", () => {
  it("sets brand text in the host's own --brand when the host declares no --brand-ink", () => {
    render(
      <div style={{ "--brand": "rgb(10, 80, 160)" }}>
        <Text variant="brand">Brand</Text>
      </div>
    );
    expect(getComputedStyle(textNamed("Brand")).color).toBe("rgb(10, 80, 160)");
  });

  it("sets brand text in the host's @theme --color-brand when the host maps it and declares no --brand-ink", async () => {
    // A Tailwind-source host that keeps its own tokens maps the brand in its own `@theme`, after
    // fuse.css, and `text-brand` follows that mapping. Brand text must follow it too.
    await injectHostBuild("@theme { --color-brand: rgb(20, 100, 90); }");
    render(<Text variant="brand">Mapped brand</Text>);
    expect(getComputedStyle(textNamed("Mapped brand")).color).toBe("rgb(20, 100, 90)");
  });

  it("sets brand text in the host's own --brand when the host clears the @theme --color-brand mapping", async () => {
    // A host that clears Tailwind's brand color, such as with `--color-brand: initial`, still
    // compiles, and brand text falls back to the `--brand` it declares.
    await injectHostBuild("@theme { --color-brand: initial; }");
    render(
      <div style={{ "--brand": "rgb(120, 30, 60)" }}>
        <Text variant="brand">Cleared brand</Text>
      </div>
    );
    expect(getComputedStyle(textNamed("Cleared brand")).color).toBe("rgb(120, 30, 60)");
  });
});

/** Compiles a Tailwind-source host that imports fuse.css, then `hostTheme`, and injects the build. */
async function injectHostBuild(hostTheme: string): Promise<void> {
  const style = document.createElement("style");
  style.textContent = await consumerCss(`${STANDALONE_ENTRY}\n${hostTheme}`, ["text-brand-ink"]);
  document.head.append(style);
  onTestFinished(() => style.remove());
}
