import type { CSSProperties } from "react";

import { describe, expect, it } from "vitest";

// No themes.css: only themes.css declares the role tokens, so these rows see a host that
// declares none of them, or only the ones it sets itself.
import "../../../dist/styles.css";
import { render } from "../../../test/browser-render";
import { effectiveOpacity, gradientStops, headingNamed } from "../../../test/themed-browser-render";
import { CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { RadioItemGroup } from "../radio-group/radio-group";
import { RadioItem } from "../radio-group/radio-item";

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

/** The fill, the stripe alphas, the title's painted opacity and its colour of a prefix's two rows. */
function disabledLooks(
  prefix: string
): readonly { fill: string; stripes: number[]; title: number; text: string }[] {
  return [`${prefix} checkbox row`, `${prefix} radio row`].map((name) => {
    const title = headingNamed(name);
    // DOM audit: the row's fill is on its shell, which no role or label reaches.
    const shell = title.closest("[data-selection-item]");
    if (!(shell instanceof HTMLElement)) {
      throw new Error(`expected the shell around ${name}`);
    }
    const style = getComputedStyle(shell);
    const stripes = gradientStops(style.backgroundImage).map(({ alpha }) => alpha);
    return {
      fill: style.backgroundColor,
      stripes,
      title: effectiveOpacity(title),
      text: getComputedStyle(title).color,
    };
  });
}

describe("SelectionItem disabled row without themes.css", () => {
  it("fills a disabled row, checked or in a disabled group, with the host's --muted under black stripes at 2% and its --foreground text", () => {
    // The neutral look, from the fallbacks in fuse.css: the host maps only the shared roles.
    render(
      <DisabledRows
        prefix="Host"
        style={{ "--muted": "#eeeeee", "--card": "#ffffff", "--foreground": "#111111" }}
      />
    );
    const expected = {
      fill: "rgb(238, 238, 238)",
      stripes: [0, 0, 0.02, 0.02],
      title: 1,
      text: "rgb(17, 17, 17)",
    };
    expect(disabledLooks("Host")).toEqual([expected, expected]);
  });
});
