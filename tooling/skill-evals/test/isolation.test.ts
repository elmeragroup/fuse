import { describe, expect, it } from "vitest";

import { isInside, scrubEnvironment } from "../src/isolation.ts";

// Unit under test: the path test that keeps `--out` outside the checkout, and the environment a
// cell's agent starts with. Oracles: POSIX path segments, and the variables pnpm sets for a script
// it runs from the checkout (`INIT_CWD`, `npm_*`, and `node_modules/.bin` entries on `PATH`).

describe("isInside", () => {
  it.each([
    { target: "/repo", inside: true },
    { target: "/repo/tooling/out", inside: true },
    { target: "/repo/..review-probe", inside: true },
    { target: "/repo-sibling", inside: false },
    { target: "/tmp/out", inside: false },
    { target: "/", inside: false },
  ])("$target", ({ target, inside }) => {
    expect(isInside("/repo", target)).toBe(inside);
  });
});

describe("scrubEnvironment", () => {
  const env = {
    HOME: "/home/me",
    INIT_CWD: "/repo",
    npm_lifecycle_event: "skill-evals",
    npm_config_user_agent: "pnpm/11",
    PWD: "/repo",
    NODE_OPTIONS: "--import /repo/tooling/x.mjs",
    RUN_DIR_HINT: "/tmp/run/1",
    PATH: "/repo/node_modules/.bin:/repo/tooling/skill-evals/node_modules/.bin:/home/me/.local/bin:/usr/bin",
    UNDEFINED: undefined,
  };

  it("drops the script's context and every variable that names a forbidden folder, and keeps the rest of PATH", () => {
    expect(scrubEnvironment(env, ["/repo", "/tmp/run"])).toEqual({
      HOME: "/home/me",
      PATH: "/home/me/.local/bin:/usr/bin",
    });
  });
});
