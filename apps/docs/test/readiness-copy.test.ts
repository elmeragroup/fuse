import { describe, expect, it } from "vitest";

import { fetchText } from "./docs-server";

const OLD_RELEASE_CLAIMS = [
  "Merging that PR publishes",
  "every PR gets an installable build",
  "package is bound to its release workflow",
] as const;

describe("release readiness copy", () => {
  it("marks automated publishing and previews as pending target state", async () => {
    const html = await fetchText("/releases");
    expect(html, "releases must say automated publish/preview infrastructure is not active yet").toContain(
      "not active yet"
    );
    expect(html, "releases must name pending org/repository setup rather than implying it is done").toContain(
      "pending org and repository setup"
    );
    expect(html, "releases must describe manual release preparation").toContain("Manual release flow");
    expect(html, "releases must say merging a release PR does not publish").toContain(
      "does not publish to npm"
    );
    expect(html, "releases must explain how to apply pending changesets").toContain(
      "pnpm exec changeset version"
    );
    expect(html, "releases must keep publishing separate from merging").toContain(
      "Merging a PR will not trigger"
    );
    expect(
      html,
      "releases must label latest as a designed/target dist-tag, not a live npm channel"
    ).toContain("latest</code> (designed)");
    expect(html, "releases must label beta as a designed/target dist-tag, not a live npm channel").toContain(
      "beta</code> (designed)"
    );
    expect(html, "releases must label per-PR previews as planned, not available today").toContain(
      "Per-PR previews (planned)"
    );
    expect(
      html,
      "releases must keep the no-token / no-local-publish rule in intended/designed language"
    ).toContain("no long-lived npm token should exist");
    expect(
      html,
      "releases must frame packed-consumer checks as intended gates, not an active release workflow"
    ).toContain("intended publish gates, not an active release workflow");
    expect(
      html,
      "releases must frame Trusted Publishing/OIDC and provenance as pending target controls"
    ).toContain("pending target controls");
  });

  it("does not keep the old unconditional publish, preview, or Trusted Publisher claims", async () => {
    const html = await fetchText("/releases");
    expect(html, "releases must not claim that merging a release PR publishes today").not.toContain(
      OLD_RELEASE_CLAIMS[0]
    );
    expect(html, "releases must not claim every PR gets an installable build today").not.toContain(
      OLD_RELEASE_CLAIMS[1]
    );
    expect(
      html,
      "releases must not claim the package is already bound as an npm Trusted Publisher"
    ).not.toContain(OLD_RELEASE_CLAIMS[2]);
    expect(
      html,
      "releases must not assert that no npm token exists on a developer machine as a current construction"
    ).not.toContain("no npm token exists on a developer machine");
  });
});

describe("visual-regression readiness copy", () => {
  it.each(["/about", "/handbook/llms-txt"] as const)(
    "%s describes visual regression as planned, not a live consumer",
    async (pathname) => {
      const html = await fetchText(pathname);
      expect(
        html,
        `${pathname} must describe the demo corpus as ready for a planned visual-regression suite`
      ).toContain("ready to become input to the planned visual-regression suite");
      expect(html, `${pathname} must not claim authored demos currently feed three consumers`).not.toContain(
        "feeds three consumers"
      );
      expect(
        html,
        `${pathname} must not claim a live three-consumer pipeline that includes visual regression`
      ).not.toContain("one pipeline with three consumers");
      expect(html, `${pathname} must not name an unqualified existing visual-regression suite`).not.toContain(
        "the visual-regression suite"
      );
    }
  );
});
