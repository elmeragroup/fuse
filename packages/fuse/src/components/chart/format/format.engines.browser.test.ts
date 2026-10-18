/**
 * This file runs the judges of format.test.ts in Chromium, Firefox and WebKit. Each engine carries
 * its own Intl data, and a server in Node and a browser in any engine must write the same text.
 */
import { describe, expect, it } from "vitest";

import { JUDGES } from "./fixtures/judges";

describe("chart formats in this engine", () => {
  it.each(JUDGES)("match the judges of %s", (_, judge) => {
    for (const judgement of judge()) {
      expect(judgement.actual, judgement.name).toEqual(judgement.expected);
    }
  });
});
