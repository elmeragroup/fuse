import { afterEach, describe, expect, it } from "vitest";

import { SiteFaq } from "../src/claude-builds/site/site-faq";
import "../src/index.css";
import { SeekedOverlay } from "../src/motion/seeked-overlay";
import { FPS } from "../src/music/beat-grid";
import { play, Scope, unmountTree } from "./frame-harness";

afterEach(unmountTree);

// Unit under test: the site's questions under `SeekedOverlay`, which opens an accordion as it
// opens an overlay. Oracles: a fresh render of the same frame, and Fuse's 150 ms height transition
// on `Accordion.Content`, two frames into which the open answer is still growing.
describe("the site's questions", () => {
  const OPEN_AT = 30;
  const ENTERING = OPEN_AT + 2;
  const AT_REST = OPEN_AT + 12;

  const tree = (frame: number) => (
    <Scope className="w-200 p-10">
      <SeekedOverlay openAt={OPEN_AT} clock={{ frame, fps: FPS }}>
        {({ open }) => <SiteFaq open={open} />}
      </SeekedOverlay>
    </Scope>
  );

  function answerHeight(): number {
    const panel = document.querySelector('[data-slot="accordion-content"]');
    if (panel === null) {
      throw new Error("The first answer is not mounted");
    }
    return panel.getBoundingClientRect().height;
  }

  it("shows an answer rewound into its opening where a fresh render of that frame shows it", async () => {
    await play([AT_REST], tree);
    const settled = answerHeight();
    unmountTree();

    await play([0, OPEN_AT, AT_REST, ENTERING], tree);
    const rewound = answerHeight();
    unmountTree();

    await play([ENTERING], tree);
    const fresh = answerHeight();

    expect(rewound).toBeCloseTo(fresh, 0);
    expect(fresh).toBeGreaterThan(0);
    expect(fresh).toBeLessThan(settled);
  });
});
