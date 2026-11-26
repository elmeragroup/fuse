/**
 * Unit under test: the fill utility in `fuse.css` that the Separator line paints through, as a
 * Tailwind-source host compiles it beside theme colors of its own. Oracle: the Separator draws
 * its line in the `--border` role, forced-colors mode needs `CanvasText` on that fill to show it,
 * and a Tailwind utility that also matches the fill class would add a later `background-color`
 * that replaces both.
 */
import { describe, expect, it } from "vitest";

import { parseScopedDeclarations } from "../../test/css-rules";
import { consumerCss, STANDALONE_ENTRY } from "../../test/tailwind-consumer-build";
import { separatorClass } from "../components/separator/separator-class";

const FORCED_COLORS = "@media (forced-colors: active)";

/** The entry of a host that imports Tailwind's sheets and no Fuse stylesheet. */
const TAILWIND_ONLY_ENTRY =
  '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css" source(none);';

/** The `background-color` declarations of the rules that select `candidate`. */
function backgrounds(css: string, candidate: string) {
  return parseScopedDeclarations(css).filter(
    ({ name, scope }) => name === "background-color" && scope.includes(`.${candidate}`)
  );
}

/** The Separator's fill class: the one its build paints `CanvasText` under forced colors. */
async function separatorFill(hostTheme: string): Promise<{ fill: string; css: string }> {
  const candidates = separatorClass.split(/\s+/u);
  const css = await consumerCss(`${STANDALONE_ENTRY}\n${hostTheme}`, candidates);
  const fills = candidates.filter((candidate) =>
    backgrounds(css, candidate).some(
      ({ value, scope }) => value === "CanvasText" && scope.includes(FORCED_COLORS)
    )
  );
  expect(fills).toHaveLength(1);
  const [fill = ""] = fills;
  return { fill, css };
}

describe("the mark fill under host theme colors", () => {
  it("keeps one background color outside forced colors under a host --color-mark-border", async () => {
    const { fill, css } = await separatorFill("@theme { --color-mark-border: #ace; }");
    expect(
      backgrounds(css, fill)
        .filter(({ scope }) => !scope.includes(FORCED_COLORS))
        .map(({ value }) => value)
    ).toEqual(["var(--border)"]);
  });

  it("matches no Tailwind utility under a host color named after any tail of the class", async () => {
    const { fill } = await separatorFill("");
    // A Tailwind utility `<prefix>-*` reads the rest of the class as a `--color-*` name, so a
    // host color for each hyphen tail lets every split of the class match a utility.
    const parts = fill.split("-");
    const colors = parts.slice(1).map((_, index) => `--color-${parts.slice(index + 1).join("-")}: #ace;`);
    const css = await consumerCss(`${TAILWIND_ONLY_ENTRY}\n@theme { ${colors.join(" ")} }`, [fill]);
    expect(parseScopedDeclarations(css).filter(({ scope }) => scope.includes(`.${fill}`))).toEqual([]);
  });
});
