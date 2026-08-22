import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../components/DocsPage";

const HREF = "/releases";

export const metadata = pageMetadata(HREF);

export default function ReleasesPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="one-package-one-version">One package, one version</h2>
      <p>
        <code>@elmeragroup/ui</code> is a single public package on npm. <code>/theme</code>,{" "}
        <code>/icons</code>, <code>/illustrations</code>, the per-component subpaths and the CSS entries are
        all exports of it, so there is no cross-package version skew to reason about. Versioning follows
        semver.
      </p>

      <h2 id="how-a-release-happens">How a release happens</h2>
      <ol>
        <li>
          <strong>A changeset per user-facing PR.</strong> Any change to published behaviour — API, styles,
          tokens, types, shipped strings — carries a changeset declaring its bump level and a human-readable
          summary. Internal-only PRs are labelled instead. The merge gate enforces this.
        </li>
        <li>
          <strong>A bot-owned Version Packages PR</strong> accumulates the pending changesets, bumps the
          version and writes the changelog from those summaries. The changelog is never hand-edited.
        </li>
        <li>
          <strong>Merging that PR publishes.</strong> The release workflow builds, runs the publish gates and
          pushes to npm. Publishing happens only from that workflow — no npm token exists on a developer
          machine, so a local publish is unauthorised by construction.
        </li>
      </ol>

      <h2 id="channels">Channels</h2>
      <ul>
        <li>
          <strong>
            <code>latest</code>
          </strong>{" "}
          — stable releases from <code>main</code>.
        </li>
        <li>
          <strong>
            <code>beta</code>
          </strong>{" "}
          — a prerelease channel via changesets pre-mode, for migration windows. Pre-mode versions never move
          the <code>latest</code> tag.
        </li>
        <li>
          <strong>Per-PR previews</strong> — every PR gets an installable build so a consuming app can trial a
          change before merge. Previews carry no dist-tag and are not releases.
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
          Router app and a Vite app, with flag assets resolving.
        </li>
      </ul>

      <h2 id="supply-chain">Provenance</h2>
      <p>
        The package is bound to its release workflow as an npm Trusted Publisher and authenticates per run via
        OIDC; there is no long-lived token to leak. Every published version carries a signed provenance
        attestation naming the source repo, commit and workflow, verifiable with{" "}
        <code>npm audit signatures</code>. Two-factor authentication is required for every org member.
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
