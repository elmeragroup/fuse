import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  fkasBranded,
  fkasPrivate,
  headingNamed,
  px,
  renderThemed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { TimelineList } from "../timeline-list/timeline-list";
import { Heading } from "./heading";

const LEVELS = [1, 2, 3, 4, 5, 6] as const;
const LEVEL_NAMES = {
  1: "Order overview",
  2: "Details",
  3: "Usage",
  4: "Period",
  5: "Meters",
  6: "Notes",
} as const;

describe("Heading", () => {
  it("defaults to heading level 2 with data-slot=heading and renders each level as the matching heading tag", () => {
    const { unmount } = renderThemed(
      <>
        {LEVELS.map((level) => (
          <Heading key={level} level={level}>
            {LEVEL_NAMES[level]}
          </Heading>
        ))}
      </>
    );
    for (const level of LEVELS) {
      const heading = headingNamed(LEVEL_NAMES[level], level);
      expect(heading.tagName).toBe(`H${level}`);
    }
    unmount();

    renderThemed(<Heading>Order overview</Heading>);
    const heading = headingNamed("Order overview", 2);
    expect(heading.tagName).toBe("H2");
    expect(heading.getAttribute("data-slot")).toBe("heading");
  });

  it("toggles noMargin, uppercase, and align, and lets className win", () => {
    renderThemed(
      <>
        <Heading noMargin>Flush</Heading>
        <Heading uppercase>Shout</Heading>
        <Heading align="left">Left</Heading>
        <Heading align="center">Centered</Heading>
        <Heading align="right">Right</Heading>
        <Heading className="text-primary">Tinted</Heading>
      </>
    );
    expect(getComputedStyle(headingNamed("Flush")).marginBottom).toBe("0px");
    expect(getComputedStyle(headingNamed("Shout")).textTransform).toBe("uppercase");
    expect(getComputedStyle(headingNamed("Left")).textAlign).toBe("left");
    expect(getComputedStyle(headingNamed("Centered")).textAlign).toBe("center");
    expect(getComputedStyle(headingNamed("Right")).textAlign).toBe("right");
    const tinted = headingNamed("Tinted");
    expect(getComputedStyle(tinted).color).toBe(cssVarColor(tinted, "--primary"));
  });
});

/** A heading's computed font size and line height in px, and its weight. */
function typeOf(name: string, level?: (typeof LEVELS)[number]) {
  const style = getComputedStyle(headingNamed(name, level));
  return { size: px(style.fontSize), leading: px(style.lineHeight), weight: style.fontWeight };
}

/**
 * Levels 1 to 3 read the theme's heading scale. The expected type is written by hand: neutral
 * themes keep h1 text-2xl, h2 text-lg and h3 text-base at the snug 1.375 ratio and 500, and
 * branded themes set h1 to heading small, 24/32, and h2 and h3 to heading xsmall, 20/32, all
 * at 700. h4 to h6 are 16/22 at 500 in every theme. `heading-without-themes.browser.test.tsx`
 * covers a host without `themes.css`.
 */
describe("Heading level scale", () => {
  const NEUTRAL = {
    1: { size: 24, leading: 33, weight: "500" },
    2: { size: 18, leading: 24.75, weight: "500" },
    3: { size: 16, leading: 22, weight: "500" },
    4: { size: 16, leading: 22, weight: "500" },
    5: { size: 16, leading: 22, weight: "500" },
    6: { size: 16, leading: 22, weight: "500" },
  } as const;
  const BRANDED = {
    1: { size: 24, leading: 32, weight: "700" },
    2: { size: 20, leading: 32, weight: "700" },
    3: { size: 20, leading: 32, weight: "700" },
    4: { size: 16, leading: 22, weight: "500" },
    5: { size: 16, leading: 22, weight: "500" },
    6: { size: 16, leading: 22, weight: "500" },
  } as const;

  it("resets the scale in a neutral scope nested in a branded one", () => {
    renderThemed(
      <ThemeScope theme={fkasBranded}>
        <Heading level={1}>Outer branded</Heading>
        <ThemeScope theme={fkasPrivate}>
          <Heading level={1}>Nested neutral</Heading>
        </ThemeScope>
      </ThemeScope>
    );
    expect(typeOf("Outer branded", 1)).toEqual(BRANDED[1]);
    expect(typeOf("Nested neutral", 1)).toEqual(NEUTRAL[1]);
  });

  it("reads level 2's roles when level is omitted", () => {
    renderThemed(
      <>
        <Heading>Neutral default</Heading>
        <ThemeScope theme={fkasBranded}>
          <Heading>Branded default</Heading>
        </ThemeScope>
      </>
    );
    expect(typeOf("Neutral default", 2)).toEqual(NEUTRAL[2]);
    expect(typeOf("Branded default", 2)).toEqual(BRANDED[2]);
  });

  it("lets an explicit size, an explicit font or both replace the branded roles, each on its own", () => {
    renderThemed(
      <ThemeScope theme={fkasBranded}>
        <Heading level={1} size="xl">
          Sized
        </Heading>
        <Heading level={1} font="default">
          Medium
        </Heading>
        <Heading level={3} size="2xl" font="semi-bold">
          Both
        </Heading>
      </ThemeScope>
    );
    // xl 20px at snug 1.375 = 27.5px, still at the level's 700.
    expect(typeOf("Sized", 1)).toEqual({ size: 20, leading: 27.5, weight: "700" });
    expect(typeOf("Medium", 1)).toEqual({ size: 24, leading: 32, weight: "500" });
    // 2xl 24px at snug 1.375 = 33px, at semi-bold 600.
    expect(typeOf("Both", 3)).toEqual({ size: 24, leading: 33, weight: "600" });
  });
});

/**
 * A TimelineList title is not a document section heading, so it keeps Heading's scale from
 * before the theme roles in every theme, written by hand: level 1 text-2xl, level 2 text-lg and
 * level 3 text-base at the snug 1.375 ratio, all at 500.
 */
describe("TimelineList title scale", () => {
  const TITLE = {
    1: { size: 24, leading: 33, weight: "500" },
    2: { size: 18, leading: 24.75, weight: "500" },
    3: { size: 16, leading: 22, weight: "500" },
  } as const;
  const TITLE_LEVELS = [1, 2, 3] as const;

  function Titles({ prefix }: { prefix: string }) {
    return (
      <TimelineList.Root>
        {TITLE_LEVELS.map((level) => (
          <TimelineList.Item key={level}>
            <TimelineList.Title level={level}>{`${prefix} ${String(level)}`}</TimelineList.Title>
          </TimelineList.Item>
        ))}
      </TimelineList.Root>
    );
  }

  it("keeps each level's earlier type in neutral and branded themes", () => {
    renderThemed(
      <>
        <Titles prefix="Neutral" />
        <ThemeScope theme={fkasBranded}>
          <Titles prefix="Branded" />
        </ThemeScope>
      </>
    );
    for (const level of TITLE_LEVELS) {
      expect(typeOf(`Neutral ${String(level)}`, level), `h${String(level)}`).toEqual(TITLE[level]);
      expect(typeOf(`Branded ${String(level)}`, level), `h${String(level)}`).toEqual(TITLE[level]);
    }
  });

  it("keeps the type when a wrapper forwards an undefined size and font", () => {
    renderThemed(
      <ThemeScope theme={fkasBranded}>
        <TimelineList.Root>
          <TimelineList.Item>
            <TimelineList.Title level={1} size={undefined} font={undefined}>
              Forwarded
            </TimelineList.Title>
          </TimelineList.Item>
        </TimelineList.Root>
      </ThemeScope>
    );
    expect(typeOf("Forwarded", 1)).toEqual(TITLE[1]);
  });

  it("lets a size or font prop replace the title's type", () => {
    renderThemed(
      <ThemeScope theme={fkasBranded}>
        <TimelineList.Root>
          <TimelineList.Item>
            <TimelineList.Title size="xl" font="semi-bold">
              Restyled
            </TimelineList.Title>
          </TimelineList.Item>
        </TimelineList.Root>
      </ThemeScope>
    );
    // xl 20px at snug 1.375 = 27.5px, at semi-bold 600.
    expect(typeOf("Restyled", 3)).toEqual({ size: 20, leading: 27.5, weight: "600" });
  });
});
