import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

/**
 * Browser project. Attribute writes on a thumb's range input while the value moves: Fuse marks
 * the input once when it attaches, so moving the thumb writes nothing to it.
 */
import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Slider } from "./slider";

describe("Slider thumb input attributes", () => {
  it("marks each thumb input once, not on every value change", async () => {
    renderThemed(withLocale("en-US", <Slider label="Size" defaultValue={10} />));
    const input = roleNamed("slider", "Size");
    expect(input.hasAttribute("data-focus-ring-control")).toBe(true);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((delivered) => {
      records.push(...delivered);
    });
    observer.observe(input, { attributes: true, attributeFilter: ["data-focus-ring-control"] });

    input.focus();
    for (let step = 0; step < 10; step += 1) {
      await userEvent.keyboard("{ArrowRight}");
    }
    expect(input.getAttribute("aria-valuenow")).toBe("20");
    records.push(...observer.takeRecords());
    observer.disconnect();
    expect(records).toHaveLength(0);
  });
});
