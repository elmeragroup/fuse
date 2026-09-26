import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withoutReleaseCredentials } from "../scripts/release-credentials";

const GH = "GH_TOKEN";
const NPM = "NODE_AUTH_TOKEN";
const GH2 = "GITHUB_TOKEN";
const OIDC = "ACTIONS_ID_TOKEN_REQUEST_TOKEN";

// The child reads its own environment, so it sees exactly what a spawned build or gate would.
const CHILD_ENV_REPORT =
  "process.stdout.write(JSON.stringify({gh: process.env.GH_TOKEN ?? null, npm: process.env.NODE_AUTH_TOKEN ?? null, gh2: process.env.GITHUB_TOKEN ?? null, oidc: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? null}))";

function stubCredentials(): void {
  vi.stubEnv(GH, "test-gh");
  vi.stubEnv(NPM, "test-npm");
  vi.stubEnv(GH2, "test-gh2");
  vi.stubEnv(OIDC, "test-oidc");
}

function expectRestored(): void {
  expect(process.env[GH]).toBe("test-gh");
  expect(process.env[NPM]).toBe("test-npm");
  expect(process.env[GH2]).toBe("test-gh2");
  expect(process.env[OIDC]).toBe("test-oidc");
}

describe("withoutReleaseCredentials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides credentials from child processes and leaves setup-node's placeholder", () => {
    stubCredentials();
    const child = withoutReleaseCredentials(() =>
      spawnSync(process.execPath, ["-e", CHILD_ENV_REPORT], { encoding: "utf8" })
    );
    const seen: unknown = JSON.parse(child.stdout);
    expect(seen).toEqual({ gh: null, npm: "XXXXX-XXXXX-XXXXX-XXXXX", gh2: null, oidc: null });
  });

  it("restores every value and passes the result through after run returns", () => {
    stubCredentials();
    expect(withoutReleaseCredentials(() => 42)).toBe(42);
    expectRestored();
  });

  it("restores every value after run throws", () => {
    stubCredentials();
    expect(() =>
      withoutReleaseCredentials(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expectRestored();
  });

  it("adds no placeholder when no npm token was set", () => {
    vi.stubEnv(NPM, undefined);
    const inside = withoutReleaseCredentials(() => process.env[NPM]);
    expect(inside).toBeUndefined();
    expect(process.env[NPM]).toBeUndefined();
  });
});
