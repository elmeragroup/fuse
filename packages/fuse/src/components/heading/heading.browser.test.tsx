import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  fkasExternal,
  fkasPrivate,
  headingNamed,
  px,
  renderThemed,
  roleNamed,
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

  it("maps auto size from level and lets an explicit size win", () => {
    renderThemed(
      <>
        <Heading level={1}>Auto 1</Heading>
        <Heading level={2}>Auto 2</Heading>
        <Heading level={3}>Auto 3</Heading>
        <Heading level={1} size="4xl">
          Override
        </Heading>
      </>
    );
    const auto1 = px(getComputedStyle(headingNamed("Auto 1", 1)).fontSize);
    const auto2 = px(getComputedStyle(headingNamed("Auto 2", 2)).fontSize);
    const auto3 = px(getComputedStyle(headingNamed("Auto 3", 3)).fontSize);
    const override = px(getComputedStyle(headingNamed("Override", 1)).fontSize);
    expect(auto1).toBeGreaterThan(auto2);
    expect(auto2).toBeGreaterThan(auto3);
    expect(override).toBeGreaterThan(auto1);
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

  it("renders the provided element with merged recipe classes", () => {
    renderThemed(
      <>
        <Heading>Details</Heading>
        <Heading render={<a href="#order" />}>Order overview</Heading>
      </>
    );
    const link = roleNamed("link", "Order overview");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#order");
    expect(link.getAttribute("data-slot")).toBe("heading");
    expect(getComputedStyle(link).fontSize).toBe(getComputedStyle(headingNamed("Details")).fontSize);
  });
});

/** A heading's computed font size and line height in px, and its weight. */
function typeOf(name: string, level?: (typeof LEVELS)[number]) {
  const style = getComputedStyle(headingNamed(name, level));
  return { size: px(style.fontSize), leading: px(style.lineHeight), weight: style.fontWeight };
}

/**
 * Levels 1 to 3 read the theme's heading scale. The expected type is written by hand: internal
 * themes keep h1 text-2xl, h2 text-lg and h3 text-base at the snug 1.375 ratio and 500, and
 * external themes set h1 to heading small, 24/32, and h2 and h3 to heading xsmall, 20/32, all
 * at 700. h4 to h6 are 16/22 at 500 in every theme. `heading-without-themes.browser.test.tsx`
 * covers a host without `themes.css`.
 */
describe("Heading level scale", () => {
  const INTERNAL = {
    1: { size: 24, leading: 33, weight: "500" },
    2: { size: 18, leading: 24.75, weight: "500" },
    3: { size: 16, leading: 22, weight: "500" },
    4: { size: 16, leading: 22, weight: "500" },
    5: { size: 16, leading: 22, weight: "500" },
    6: { size: 16, leading: 22, weight: "500" },
  } as const;
  const EXTERNAL = {
    1: { size: 24, leading: 32, weight: "700" },
    2: { size: 20, leading: 32, weight: "700" },
    3: { size: 20, leading: 32, weight: "700" },
    4: { size: 16, leading: 22, weight: "500" },
    5: { size: 16, leading: 22, weight: "500" },
    6: { size: 16, leading: 22, weight: "500" },
  } as const;

  function LevelHeadings({ prefix }: { prefix: string }) {
    return (
      <>
        {LEVELS.map((level) => (
          <Heading key={level} level={level}>{`${prefix} ${String(level)}`}</Heading>
        ))}
      </>
    );
  }

  it("sets each level's type in internal and external themes, in light and dark", () => {
    renderThemed(
      <>
        <LevelHeadings prefix="Internal" />
        <ThemeScope theme={fkasExternal}>
          <LevelHeadings prefix="External" />
        </ThemeScope>
        <div data-theme="dark">
          <ThemeScope theme={fkasPrivate}>
            <LevelHeadings prefix="Dark internal" />
          </ThemeScope>
          <ThemeScope theme={fkasExternal}>
            <LevelHeadings prefix="Dark external" />
          </ThemeScope>
        </div>
      </>
    );
    for (const level of LEVELS) {
      expect(typeOf(`Internal ${String(level)}`, level), `h${String(level)}`).toEqual(INTERNAL[level]);
      expect(typeOf(`External ${String(level)}`, level), `h${String(level)}`).toEqual(EXTERNAL[level]);
      expect(typeOf(`Dark internal ${String(level)}`, level), `h${String(level)}`).toEqual(INTERNAL[level]);
      expect(typeOf(`Dark external ${String(level)}`, level), `h${String(level)}`).toEqual(EXTERNAL[level]);
    }
  });

  it("resets the scale in an internal scope nested in an external one", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Heading level={1}>Outer external</Heading>
        <ThemeScope theme={fkasPrivate}>
          <Heading level={1}>Nested internal</Heading>
        </ThemeScope>
      </ThemeScope>
    );
    expect(typeOf("Outer external", 1)).toEqual(EXTERNAL[1]);
    expect(typeOf("Nested internal", 1)).toEqual(INTERNAL[1]);
  });

  it("reads level 2's roles when level is omitted", () => {
    renderThemed(
      <>
        <Heading>Internal default</Heading>
        <ThemeScope theme={fkasExternal}>
          <Heading>External default</Heading>
        </ThemeScope>
      </>
    );
    expect(typeOf("Internal default", 2)).toEqual(INTERNAL[2]);
    expect(typeOf("External default", 2)).toEqual(EXTERNAL[2]);
  });

  it("lets an explicit size, an explicit font or both replace the external roles, each on its own", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
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

  it("lets a className size, line height or weight replace the external roles", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Heading level={1} className="text-3xl">
          Large class
        </Heading>
        <Heading level={1} className="leading-tight">
          Tight class
        </Heading>
        <Heading level={2} className="font-normal">
          Regular class
        </Heading>
      </ThemeScope>
    );
    // text-3xl is 30px with its own 1.2 line height, 36px: the size class drops the leading role.
    expect(typeOf("Large class", 1)).toEqual({ size: 30, leading: 36, weight: "700" });
    // leading-tight 24 × 1.25 = 30px.
    expect(typeOf("Tight class", 1)).toEqual({ size: 24, leading: 30, weight: "700" });
    expect(typeOf("Regular class", 2)).toEqual({ size: 20, leading: 32, weight: "400" });
  });
});

/**
 * A `typography` style sets the size, line height and weight at any level. The expected type is
 * written by hand: internal themes set Tailwind's text-4xl, text-3xl, text-2xl and text-lg at
 * the snug 1.375 ratio, all at 500, and external themes the design's bold heading ramp, large
 * 34/40, medium 28/34, small 24/32 and xsmall 20/32, all at 700.
 */
describe("Heading named styles", () => {
  const STYLES = ["large", "medium", "small", "xsmall"] as const;
  const INTERNAL = {
    large: { size: 36, leading: 49.5, weight: "500" },
    medium: { size: 30, leading: 41.25, weight: "500" },
    small: { size: 24, leading: 33, weight: "500" },
    xsmall: { size: 18, leading: 24.75, weight: "500" },
  } as const;
  const EXTERNAL = {
    large: { size: 34, leading: 40, weight: "700" },
    medium: { size: 28, leading: 34, weight: "700" },
    small: { size: 24, leading: 32, weight: "700" },
    xsmall: { size: 20, leading: 32, weight: "700" },
  } as const;

  function StyledHeadings({ prefix }: { prefix: string }) {
    return (
      <>
        {STYLES.map((style) => (
          <Heading key={style} typography={style}>{`${prefix} ${style}`}</Heading>
        ))}
      </>
    );
  }

  it("sets each style's type in internal and external themes, in light and dark", () => {
    renderThemed(
      <>
        <StyledHeadings prefix="Internal" />
        <ThemeScope theme={fkasExternal}>
          <StyledHeadings prefix="External" />
        </ThemeScope>
        <div data-theme="dark">
          <ThemeScope theme={fkasPrivate}>
            <StyledHeadings prefix="Dark internal" />
          </ThemeScope>
          <ThemeScope theme={fkasExternal}>
            <StyledHeadings prefix="Dark external" />
          </ThemeScope>
        </div>
      </>
    );
    for (const style of STYLES) {
      expect(typeOf(`Internal ${style}`, 2), style).toEqual(INTERNAL[style]);
      expect(typeOf(`External ${style}`, 2), style).toEqual(EXTERNAL[style]);
      expect(typeOf(`Dark internal ${style}`, 2), style).toEqual(INTERNAL[style]);
      expect(typeOf(`Dark external ${style}`, 2), style).toEqual(EXTERNAL[style]);
    }
  });

  it("keeps the level for the outline while the style sets the type, at a themed level and at h4", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Heading level={2} typography="medium">
          Medium h2
        </Heading>
        <Heading level={4} typography="xsmall">
          Bold h4
        </Heading>
        <Heading level={1} typography="large">
          Large h1
        </Heading>
      </ThemeScope>
    );
    expect(typeOf("Medium h2", 2)).toEqual(EXTERNAL.medium);
    expect(typeOf("Bold h4", 4)).toEqual(EXTERNAL.xsmall);
    expect(typeOf("Large h1", 1)).toEqual(EXTERNAL.large);
  });

  it("lets a className size, line height or weight replace a style's", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Heading typography="small" className="text-3xl">
          Large class
        </Heading>
        <Heading typography="small" className="leading-tight">
          Tight class
        </Heading>
        <Heading typography="small" className="font-normal">
          Regular class
        </Heading>
      </ThemeScope>
    );
    // text-3xl is 30px with its own 1.2 line height, 36px: the size class drops the leading role.
    expect(typeOf("Large class", 2)).toEqual({ size: 30, leading: 36, weight: "700" });
    // leading-tight 24 × 1.25 = 30px.
    expect(typeOf("Tight class", 2)).toEqual({ size: 24, leading: 30, weight: "700" });
    expect(typeOf("Regular class", 2)).toEqual({ size: 24, leading: 32, weight: "400" });
  });

  it("lets the style win over a size and font a JavaScript caller passes anyway", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        {/* @ts-expect-error the type excludes size and font beside typography, as a JavaScript caller would not know */}
        <Heading typography="medium" size="xl" font="normal">
          Loose props
        </Heading>
      </ThemeScope>
    );
    expect(typeOf("Loose props", 2)).toEqual(EXTERNAL.medium);
  });

  it("moves a style and the level that points at it when a theme scope overrides the style role", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal} style={{ "--heading-small-size": "1.75rem" }}>
        <Heading typography="small">Styled small</Heading>
        <Heading level={1}>Default h1</Heading>
      </ThemeScope>
    );
    // 1.75rem is 28px; the line height and weight stay heading small's 32px and 700.
    expect(typeOf("Styled small", 2)).toEqual({ size: 28, leading: 32, weight: "700" });
    expect(typeOf("Default h1", 1)).toEqual({ size: 28, leading: 32, weight: "700" });
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

  it("keeps each level's earlier type in internal and external themes", () => {
    renderThemed(
      <>
        <Titles prefix="Internal" />
        <ThemeScope theme={fkasExternal}>
          <Titles prefix="External" />
        </ThemeScope>
      </>
    );
    for (const level of TITLE_LEVELS) {
      expect(typeOf(`Internal ${String(level)}`, level), `h${String(level)}`).toEqual(TITLE[level]);
      expect(typeOf(`External ${String(level)}`, level), `h${String(level)}`).toEqual(TITLE[level]);
    }
  });

  it("keeps the type when a wrapper forwards an undefined size and font", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
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

  it("forwards a typography style, which replaces the title's pinned type", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <TimelineList.Root>
          <TimelineList.Item>
            <TimelineList.Title typography="xsmall">Styled</TimelineList.Title>
          </TimelineList.Item>
        </TimelineList.Root>
      </ThemeScope>
    );
    // The external heading xsmall style, 20/32 at 700, on the title's default level 3.
    expect(typeOf("Styled", 3)).toEqual({ size: 20, leading: 32, weight: "700" });
  });

  it("lets a size or font prop replace the title's type", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
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
