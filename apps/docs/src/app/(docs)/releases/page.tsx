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
        <code>RELEASE_ENABLED</code> variable, alongside the pending org and repository setup (the{" "}
        <code>@elmeragroup/fuse</code> name claim, the repository going public, and required org 2FA). Until
        then nothing publishes and no release PR is opened. Per-PR installable package previews and docs
        previews are planned, not available for every PR today; they wait on Vercel and pkg-pr-new.
      </p>

      <h2 id="release-flow">Release flow</h2>
      <p>
        Add a changeset with <code>pnpm changeset</code> for every PR that changes published behaviour,
        including API, styles, tokens, types, and shipped strings. Internal-only PRs use the{" "}
        <code>no-changeset</code> label instead. Pending notes accumulate on <code>main</code>. Once
        publishing is activated, every push publishes a canary and the bot opens or updates the Version
        Packages PR by applying the pending notes (<code>pnpm release:version</code>,{" "}
        <code>changeset version</code> plus a lockfile refresh); merging that PR publishes the stable line.
        The changelog is generated and never hand-edited; the rest of the procedure lives in the{" "}
        <Link href="https://github.com/elmeragroup/fuse/blob/main/scripts/RELEASE.md" rel="noreferrer">
          release runbook
        </Link>
        .
      </p>
      <p>
        <strong>Publishing is a CI action, gated on activation.</strong> Once activated, every ordinary merge
        publishes a canary, and stable releases ship by merging the Version Packages PR; a failed publication
        is retried from its recorded archive. The pipeline authenticates with a scoped npm token today; OIDC
        Trusted Publishing with signed provenance is the target, and local publishing remains outside this
        flow.
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
      <p>
        Once activated, the release workflow packs the tarball once and publishes only when these gates pass
        against those exact bytes. Nothing publishes today; see{" "}
        <Link href="#current-readiness">Current readiness</Link>. Until activation these are intended publish
        gates, not an active release workflow.
      </p>

      <h3 id="active-gates">Active publish gates</h3>
      <ul>
        <li>
          <strong>
            <code>package:check</code>
          </strong>{" "}
          — publint and arethetypeswrong, the exports map resolving against the published shape,
          emitted-directive parity, peer ranges, runtime exports, the React compatibility matrix, the Tailwind
          floor compile and packaged flag assets.
        </li>
        <li>
          <strong>
            <code>size-limit</code>
          </strong>{" "}
          — every ceiling on the <Link href="/handbook/tokens">Tokens</Link> page holds.
        </li>
        <li>
          <strong>
            <code>test:packed-consumer</code>
          </strong>{" "}
          — the tarball renders controls at the documented geometry in both the standalone-CSS and
          Tailwind-source modes, and a Vite production build of the tarball in standalone-CSS mode serves its
          flag SVGs as external assets.
        </li>
      </ul>

      <h3 id="merge-gates">Merge gates</h3>
      <p>
        The 20-theme token contract and the unit, type and browser suites run on every merge to{" "}
        <code>main</code>, not against the packed tarball.
      </p>

      <h3 id="pending-gates">Pending gates</h3>
      <p>
        A packed Next App Router fixture — Tailwind-source mode, a server page and a client island — is
        designed but not yet built. The{" "}
        <Link href="https://github.com/elmeragroup/fuse/blob/main/scripts/RELEASE.md" rel="noreferrer">
          release runbook
        </Link>{" "}
        tracks it.
      </p>

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
        family names only — and brand logos do ship publicly in <code>@elmeragroup/fuse/icons</code>.
      </p>
    </DocsPage>
  );
}
