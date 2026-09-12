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
        Maintainers prepare release PRs manually from accumulated changesets. Merging a release PR records the
        version and changelog; it does not publish to npm. A manually triggered publishing workflow is planned
        after the pending org and repository setup: npm package and scope ownership, OIDC Trusted Publishing,
        and required org 2FA. Per-PR installable package previews and docs previews are planned, not available
        for every PR today; they wait on Vercel and pkg-pr-new.
      </p>

      <h2 id="designed-flow">Manual release flow</h2>
      <p>
        Add a changeset with <code>pnpm changeset</code> for every PR that changes published behaviour,
        including API, styles, tokens, types, and shipped strings. Internal-only PRs use the{" "}
        <code>no-changeset</code> label instead. Pending notes accumulate on <code>main</code>; no workflow
        automatically opens a release PR or publishes the package. When a maintainer prepares the next
        release, <code>pnpm exec changeset version</code> applies the pending notes; the rest of the procedure
        lives in the{" "}
        <Link href="https://github.com/elmeragroup/ui/blob/main/docs/spec/release.md" rel="noreferrer">
          release runbook
        </Link>
        . Merging the release PR records the version and changelog; it does not publish to npm, and the
        changelog is never hand-edited.
      </p>
      <p>
        <strong>Publishing is a separate, planned action.</strong> After the pending setup is complete, a
        maintainer will explicitly trigger a workflow for the reviewed release commit on <code>main</code>. It
        will build, run the publish gates, and publish the checked package to npm. Merging a PR will not
        trigger publishing. The designed flow uses OIDC so no long-lived npm token should exist on a developer
        machine, and local publishing remains outside this flow.
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
            <code>beta</code> (designed)
          </strong>{" "}
          — target prerelease channel via changesets pre-mode, for migration windows. Pre-mode versions never
          move the <code>latest</code> tag. Not a live npm channel today.
        </li>
        <li>
          <strong>Per-PR previews (planned)</strong> — an installable build of each PR so a consuming app can
          trial a change before merge. Previews carry no dist-tag and are not releases. They are not available
          for every PR today.
        </li>
      </ul>

      <h2 id="publish-gates">Publish gates</h2>
      <p>The designed release workflow publishes only when all of these hold against the packed artifact:</p>
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
        member are pending target controls, not already configured. The designed flow authenticates each
        publish run via OIDC, with no long-lived token to leak. Every published version is intended to carry a
        signed provenance attestation naming the source repo, commit and workflow, verifiable with{" "}
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
