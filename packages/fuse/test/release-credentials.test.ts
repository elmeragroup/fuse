import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withoutReleaseCredentials } from "../scripts/release-credentials";

const GH = "GH_TOKEN";
const GH2 = "GITHUB_TOKEN";
const OIDC = "ACTIONS_ID_TOKEN_REQUEST_TOKEN";
const OIDC_URL = "ACTIONS_ID_TOKEN_REQUEST_URL";

// The child reads its own environment, so it sees exactly what a spawned build or gate would.
const CHILD_ENV_REPORT =
  "process.stdout.write(JSON.stringify({gh: process.env.GH_TOKEN ?? null, gh2: process.env.GITHUB_TOKEN ?? null, oidc: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? null, oidcUrl: process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? null}))";

function stubCredentials(): void {
  vi.stubEnv(GH, "test-gh");
  vi.stubEnv(GH2, "test-gh2");
  vi.stubEnv(OIDC, "test-oidc");
  vi.stubEnv(OIDC_URL, "test-oidc-url");
}

function expectRestored(): void {
  expect(process.env[GH]).toBe("test-gh");
  expect(process.env[GH2]).toBe("test-gh2");
  expect(process.env[OIDC]).toBe("test-oidc");
  expect(process.env[OIDC_URL]).toBe("test-oidc-url");
}

describe("withoutReleaseCredentials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides credentials from child processes", () => {
    stubCredentials();
    const child = withoutReleaseCredentials(() =>
      spawnSync(process.execPath, ["-e", CHILD_ENV_REPORT], { encoding: "utf8" })
    );
    const seen: unknown = JSON.parse(child.stdout);
    expect(seen).toEqual({ gh: null, gh2: null, oidc: null, oidcUrl: null });
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
});
