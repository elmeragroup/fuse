import type { CSSProperties } from "react";

import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

// No themes.css: only themes.css declares the role tokens, so these rows see a host that
// declares none of them, or only the ones it sets itself.
import "../../../dist/styles.css";
import { render } from "../../../test/browser-render";
import { effectiveOpacity, headingNamed } from "../../../test/themed-browser-render";
import { CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { RadioItemGroup } from "../radio-group/radio-group";
import { RadioItem } from "../radio-group/radio-item";

function TitleRows({ prefix, style }: { prefix: string; style?: CSSProperties }) {
  return (
    <div style={style}>
      <CheckboxItemGroup label={`${prefix} add-ons`}>
        <CheckboxItem value="router">
          <CheckboxItem.Title role="heading" aria-level={3}>
            {`${prefix} checkbox row`}
          </CheckboxItem.Title>
        </CheckboxItem>
      </CheckboxItemGroup>
      <RadioItemGroup label={`${prefix} plan`}>
        <RadioItem value="fixed">
          <RadioItem.Title role="heading" aria-level={3}>
            {`${prefix} radio row`}
          </RadioItem.Title>
        </RadioItem>
      </RadioItemGroup>
    </div>
  );
}

/** The computed weights of a prefix's checkbox and radio row titles. */
function titleWeights(prefix: string): readonly string[] {
  return [`${prefix} checkbox row`, `${prefix} radio row`].map(
    (name) => getComputedStyle(headingNamed(name)).fontWeight
  );
}

describe("SelectionItem title weight without themes.css", () => {
  it("sets row titles at the internal 400 when the host sets no --selection-title-weight", () => {
    render(<TitleRows prefix="Host" />);
    expect(titleWeights("Host")).toEqual(["400", "400"]);
  });

  it("sets row titles at the host's own --selection-title-weight", () => {
    // The external themes' medium title, mapped by a host that keeps its own tokens.
    render(<TitleRows prefix="Mapped" style={{ "--selection-title-weight": "500" }} />);
    expect(titleWeights("Mapped")).toEqual(["500", "500"]);
  });
});

/** A row, single or in a disabled group, for the disabled-row checks below. */
function DisabledRows({ prefix, style }: { prefix: string; style?: CSSProperties }) {
  return (
    <div style={style}>
      <CheckboxItemGroup label={`${prefix} add-ons`} defaultValue={["router"]}>
        <CheckboxItem value="router" isDisabled>
          <CheckboxItem.Title role="heading" aria-level={3}>
            {`${prefix} checkbox row`}
          </CheckboxItem.Title>
        </CheckboxItem>
      </CheckboxItemGroup>
      <RadioItemGroup label={`${prefix} plan`} isDisabled>
        <RadioItem value="fixed">
          <RadioItem.Title role="heading" aria-level={3}>
            {`${prefix} radio row`}
          </RadioItem.Title>
        </RadioItem>
      </RadioItemGroup>
    </div>
  );
}

/** The fill, the stripe alphas and the title's painted opacity of a prefix's two rows. */
function disabledLooks(prefix: string): readonly { fill: string; stripes: number[]; title: number }[] {
  return [`${prefix} checkbox row`, `${prefix} radio row`].map((name) => {
    const title = headingNamed(name);
    // DOM audit: the row's fill is on its shell, which no role or label reaches.
    const shell = title.closest("[data-selection-item]");
    if (!(shell instanceof HTMLElement)) {
      throw new Error(`expected the shell around ${name}`);
    }
    const style = getComputedStyle(shell);
    const stripes = [...style.backgroundImage.matchAll(/(?:rgba?|oklch|lab)\([^()]*\)/g)].map(
      ([stop]) => CssColor.toSrgb(getOrThrow(CssColor.parse(stop))).alpha
    );
    return { fill: style.backgroundColor, stripes, title: effectiveOpacity(title) };
  });
}

describe("SelectionItem disabled row without themes.css", () => {
  it("fills a disabled row, checked or in a disabled group, with the host's --muted under black stripes at 2%", () => {
    // The internal look, from the fallbacks in fuse.css: the host maps only the shared roles.
    render(<DisabledRows prefix="Host" style={{ "--muted": "#eeeeee", "--card": "#ffffff" }} />);
    const expected = { fill: "rgb(238, 238, 238)", stripes: [0, 0, 0.02, 0.02], title: 0.5 };
    expect(disabledLooks("Host")).toEqual([expected, expected]);
  });

  it("fills a disabled row with the host's own disabled roles", () => {
    // The external look, mapped by a host: the card fill and no stripes, even on a checked row.
    render(
      <DisabledRows
        prefix="Mapped"
        style={{
          "--muted": "#eeeeee",
          "--card": "#ffffff",
          "--selection-disabled-background": "var(--card)",
          "--selection-disabled-hatch": "oklch(0 0 0 / 0)",
        }}
      />
    );
    const expected = { fill: "rgb(255, 255, 255)", stripes: [0, 0, 0, 0], title: 0.5 };
    expect(disabledLooks("Mapped")).toEqual([expected, expected]);
  });
});
