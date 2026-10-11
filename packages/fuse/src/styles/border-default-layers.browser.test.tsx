import { afterEach, describe, expect, it } from "vitest";

import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { layeredConsumerCss } from "../../test/layered-consumer-css";
import { fkasPrivate } from "../../test/theme-fixtures";
import { cssVarColor, roleNamed } from "../../test/themed-browser-render";
import { Card } from "../components/card/card";
import { cardVariants } from "../components/card/card-variants";
import { ThemeScope } from "../theme/theme-scope";

/** The preflight-free entry the quick-start documents: the host states the order first. */
const HOST_ORDERED = [
  "@layer theme, base, components, utilities;",
  '@import "tailwindcss/theme.css" layer(theme);',
  '@import "tailwindcss/utilities.css" layer(utilities);',
  '@import "./fuse.css";',
].join("\n");

/** No host statement, fuse.css first: fuse.css's own statement must order the layers. */
const FUSE_FIRST = ['@import "./fuse.css";', '@import "tailwindcss/utilities.css" layer(utilities);'].join(
  "\n"
);

/** The classes the Cards below spell. */
const CANDIDATES = [...cardVariants().base().split(" "), "border-primary"];

describe("the base-layer border default in a layered consumer build", () => {
  let style: HTMLStyleElement | undefined;

  afterEach(() => {
    style?.remove();
  });

  it.each([
    ["host-ordered", HOST_ORDERED],
    ["fuse-first", FUSE_FIRST],
  ])("draws a bare border in --border and lets border-primary win, %s", async (_, entry) => {
    style = document.createElement("style");
    style.textContent = await layeredConsumerCss(entry, CANDIDATES);
    document.head.append(style);
    render(
      <ThemeScope theme={fkasPrivate}>
        <Card.Root role="group" aria-label="Card" />
        <Card.Root role="group" aria-label="Primary card" className="border-primary" />
      </ThemeScope>
    );
    const bare = roleNamed("group", "Card");
    const primary = roleNamed("group", "Primary card");
    // The two roles must differ, or the second assertion cannot tell them apart.
    expect(cssVarColor(primary, "--primary")).not.toBe(cssVarColor(primary, "--border"));
    expect(getComputedStyle(bare).borderTopColor).toBe(cssVarColor(bare, "--border"));
    expect(getComputedStyle(primary).borderTopColor).toBe(cssVarColor(primary, "--primary"));
  });
});
