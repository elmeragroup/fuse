import type { CSSProperties } from "react";

import { describe, expect, it } from "vitest";

// No themes.css: only themes.css declares the role tokens, so these rows see a host that
// declares none of them, or only the ones it sets itself.
import "../../../dist/styles.css";
import { render } from "../../../test/browser-render";
import { headingNamed } from "../../../test/themed-browser-render";
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
