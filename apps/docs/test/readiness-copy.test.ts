import { describe, expect, it } from "vitest";

import { fetchText } from "./docs-server";

const OLD_RELEASE_CLAIMS = ["Merging that PR publishes", "every PR gets an installable build"] as const;

describe("release readiness copy", () => {
  it("marks automated publishing and previews as pending target state, without the old unconditional claims", async () => {
    const html = await fetchText("/releases");
    expect(html, "releases must say automated publish/preview infrastructure is not active yet").toContain(
      "not active yet"
    );
    expect(html, "releases must name pending org/repository setup rather than implying it is done").toContain(
      "pending org and repository setup"
    );
    expect(html, "releases must describe the release flow as gated on activation").toContain(
      "gated on activation"
    );
    expect(html, "releases must name the activation switch").toContain("RELEASE_ENABLED");
    expect(html, "releases must explain how pending notes are applied").toContain("pnpm release:version");
    expect(html, "releases must say activated ordinary merges publish canaries").toContain(
      "every ordinary merge publishes a canary"
    );
    expect(html, "releases must scope the stable publish to activation").toContain(
      "Once publishing is activated"
    );
    expect(
      html,
      "releases must label latest as a designed/target dist-tag, not a live npm channel"
    ).toContain("latest</code> (designed)");
    expect(
      html,
      "releases must label canary as a designed/target dist-tag, not a live npm channel"
    ).toContain("canary</code> (designed)");
    expect(html, "releases must label per-PR previews as planned, not available today").toContain(
      "Per-PR previews (planned)"
    );
    expect(html, "releases must name trusted publishing over OIDC as the npm authentication").toContain(
      "authenticates to npm through trusted publishing (OIDC)"
    );
    expect(
      html,
      "releases must describe signed provenance as current for publications from merges"
    ).toContain("version a merge publishes carries a signed provenance attestation");
    expect(html, "releases must not describe an npm token as a pipeline credential").not.toContain(
      "npm token"
    );
    expect(
      html,
      "releases must frame packed-consumer checks as intended gates, not an active release workflow"
    ).toContain("intended publish gates, not an active release workflow");
    expect(html, "releases must list the packed Next fixture as an active gate").toContain(
      "A packed Next App Router app renders server namespace parts, hydrates a client island and styles package classes through Tailwind source scanning."
    );
    expect(html, "releases must not keep an empty pending-gates section").not.toContain("Pending gates");
    expect(
      html,
      "releases must not list the merge-suite theme contract as a packed-artifact gate"
    ).not.toContain("theme-contract test");
    expect(html, "releases must keep org-wide two-factor authentication a pending target control").toContain(
      "two-factor authentication for every org member is still a pending target control"
    );
    expect(html, "releases must not claim that merging a release PR publishes today").not.toContain(
      OLD_RELEASE_CLAIMS[0]
    );
    expect(html, "releases must not claim every PR gets an installable build today").not.toContain(
      OLD_RELEASE_CLAIMS[1]
    );
  });
});

describe("visual-regression readiness copy", () => {
  it.each(["/about", "/handbook/llms-txt"] as const)(
    "%s describes visual regression as trigger-based, not a live consumer",
    async (pathname) => {
      const html = await fetchText(pathname);
      expect(html, `${pathname} must describe visual-regression coverage as trigger-based`).toContain(
        "added when behavioral tests miss a visual regression"
      );
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
