import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../components/docs-page";

const HREF = "/releases";

export const metadata = pageMetadata(HREF);

export default function ReleasesPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="current-readiness">Current readiness</h2>
      <p>
        Automated npm publishing and per-PR preview infrastructure are <strong>not active yet</strong>.
        Publishing stays off until activation: the repository needs its npm token secret and the{" "}
        <code>RELEASE_ENABLED</code> variable, alongside the pending org and repository setup (npm package and
        scope ownership, the repository going public, and required org 2FA). Until then nothing publishes and
        no release PR is opened. Per-PR installable package previews and docs previews are planned, not
        available for every PR today; they wait on Vercel and pkg-pr-new.
      </p>

      <h2 id="release-flow">Release flow</h2>
      <p>
        Add a changeset with <code>pnpm changeset</code> for every PR that changes published behaviour,
        including API, styles, tokens, types, and shipped strings. Internal-only PRs use the{" "}
        <code>no-changeset</code> label instead. Pending notes accumulate on <code>main</code>. Once
        publishing is activated, every push publishes a canary and the bot opens or updates the Version
        Packages PR by applying the pending notes (<code>pnpm exec changeset version</code>); merging that PR
        publishes the stable line. The changelog is generated and never hand-edited; the rest of the procedure
        lives in the{" "}
        <Link href="https://github.com/elmeragroup/ui/blob/main/docs/spec/release.md" rel="noreferrer">
          release runbook
        </Link>
        .
      </p>
      <p>
        <strong>Publishing is a CI action, gated on activation.</strong> Once activated, canaries publish
        automatically on every merge to <code>main</code> and stable releases ship by merging the Version
        Packages PR; a failed publication is retried from its recorded archive. Merging ordinary PRs never
        publishes. The pipeline authenticates with a scoped npm token today; OIDC Trusted Publishing with
        signed provenance is the target, and local publishing remains outside this flow.
      </p>

      <h2 id="channels">Channels</h2>
      <ul>
        <li>
          <strong>
            <code>latest</code> (designed)
          </strong>{" "}
          — target dist-tag for stable releases from <code>main</code>. Not a live npm channel today.
        </li>
        <li>
          <strong>
            <code>canary</code> (designed)
          </strong>{" "}
          — target prerelease channel; each activated merge to <code>main</code> publishes{" "}
          <code>x.y.z-canary.N</code>. Prerelease versions never move the <code>latest</code> tag. Not a live
          npm channel today.
        </li>
        <li>
          <strong>Per-PR previews (planned)</strong> — an installable build of each PR so a consuming app can
          trial a change before merge. Previews carry no dist-tag and are not releases. They are not available
          for every PR today.
        </li>
      </ul>

      <h2 id="publish-gates">Publish gates</h2>
      <p>The release workflow publishes only when all of these hold against the packed artifact:</p>
      <ul>
        <li>
          <strong>publint</strong> and <strong>arethetypeswrong</strong> — the published package shape and its
          type resolution across module modes.
        </li>
        <li>
          <strong>exports-map test</strong> — every generated subpath resolves against the published shape,
          not just the in-repo one.
        </li>
        <li>
          <strong>emitted-directive parity</strong> — all and only the source modules with a leading{" "}
          <code>&quot;use client&quot;</code> keep it in the packed JavaScript.
        </li>
        <li>
          <strong>size-limit budgets</strong> — every ceiling on the{" "}
          <Link href="/handbook/tokens">Tokens</Link> page holds.
        </li>
        <li>
          <strong>theme-contract test</strong> — the 20-theme token contract holds in the built CSS.
        </li>
        <li>
          <strong>Packed consumer fixtures</strong> — the tarball installs and builds in both a Next App
          Router app and a Vite app, with flag assets resolving. These checks are intended publish gates, not
          an active release workflow today.
        </li>
      </ul>

      <h2 id="supply-chain">Provenance</h2>
      <p>
        Trusted Publishing via OIDC, signed provenance, and required two-factor authentication for every org
        member are pending target controls, not already configured. Until the OIDC pivot, publish runs
        authenticate with a scoped npm token; it is the pipeline&apos;s only long-lived credential and is
        rotated when maintainers change. Every published version is intended to carry a signed provenance
        attestation naming the source repo, commit and workflow, verifiable with{" "}
        <code>npm audit signatures</code>.
      </p>

      <h2 id="licensing">Licensing</h2>
      <p>
        The code is MIT, matching the whole dependency stack. Two constraints follow from that and bound what
        the tarball may contain: <strong>the library never ships font files</strong> — fonts are app-supplied
        through the <code>--font-sans</code> and <code>--font-heading</code> tokens, and themes reference
        family names only — and brand logos do ship publicly in <code>@elmeragroup/ui/icons</code>.
      </p>
    </DocsPage>
  );
}
