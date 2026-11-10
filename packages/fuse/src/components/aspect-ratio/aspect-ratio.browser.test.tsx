import { beforeAll, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { consumerCss } from "../../../test/tailwind-consumer-build";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { AspectRatio } from "./aspect-ratio";

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
});
