import { beforeAll, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { consumerCss } from "../../../test/tailwind-consumer-build";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { AspectRatio } from "./aspect-ratio";
import type { AspectRatioValue } from "./aspect-ratio";

/** Each ratio string and the `aspect-ratio` Chromium computes for it, written by hand. */
const COMPUTED_RATIO = [
  ["1:1", "1 / 1"],
  ["4:3", "4 / 3"],
  ["3:4", "3 / 4"],
  ["3:2", "3 / 2"],
  ["2:3", "2 / 3"],
  ["16:9", "16 / 9"],
  ["9:16", "9 / 16"],
] as const satisfies readonly (readonly [AspectRatioValue, string])[];

describe("AspectRatio", () => {
  beforeAll(async () => {
    // A Tailwind-source consumer's own utility. It goes first in the head, so where it ties with a
    // shipped ratio class the shipped rule wins: only a ratio class dropped from the element lets
    // the consumer's ratio apply.
    const style = document.createElement("style");
    style.textContent = await consumerCss('@import "tailwindcss/utilities.css" source(none);', [
      "aspect-[7/5]",
    ]);
    document.head.prepend(style);
  });

  it.each(COMPUTED_RATIO)("frames %s content at %s", (ratio, computed) => {
    renderThemed(
      <div style={{ width: "240px" }}>
        <AspectRatio ratio={ratio} role="group" aria-label={ratio} />
      </div>
    );
    const frame = roleNamed("group", ratio);
    expect(getComputedStyle(frame).aspectRatio).toBe(computed);
    expect(frame.getAttribute("data-ratio")).toBe(ratio);
    expect(getComputedStyle(frame).position).toBe("relative");
  });

  it("keeps 16:9 when the host redefines Tailwind's --aspect-video", () => {
    renderThemed(
      <div style={{ width: "240px", "--aspect-video": "4 / 3" }}>
        <AspectRatio ratio="16:9" role="group" aria-label="Video" />
      </div>
    );
    const frame = roleNamed("group", "Video");
    expect(getComputedStyle(frame).aspectRatio).toBe("16 / 9");
    expect(frame.getBoundingClientRect().height).toBe(135);
  });

  it("keeps its height when a full-size image fills it in a host without preflight", () => {
    renderThemed(
      <div style={{ width: "240px" }}>
        <AspectRatio ratio="16:9" role="group" aria-label="Photo frame">
          <img
            className="size-full object-cover"
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E"
            alt="Meter"
          />
        </AspectRatio>
      </div>
    );
    expect(roleNamed("group", "Photo frame").getBoundingClientRect().height).toBe(135);
    expect(roleNamed("img", "Meter").getBoundingClientRect().height).toBe(135);
  });

  it("lets a consumer aspect class replace the ratio", () => {
    renderThemed(
      <div style={{ width: "280px" }}>
        <AspectRatio ratio="16:9" className="aspect-[7/5]" role="group" aria-label="Custom" />
      </div>
    );
    const frame = roleNamed("group", "Custom");
    expect(getComputedStyle(frame).aspectRatio).toBe("7 / 5");
    expect(frame.getBoundingClientRect().height).toBe(200);
    expect(frame.getAttribute("data-ratio")).toBe("16:9");
  });
});
