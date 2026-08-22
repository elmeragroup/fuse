import type { ReactElement } from "react";

import { DocsPage, pageMetadata } from "../../../../components/DocsPage";

const HREF = "/handbook/icons";

export const metadata = pageMetadata(HREF);

const IMPORT = `import { Check, MagnifyingGlass } from "@elmeragroup/ui/icons";

<Check />                       // decorative: aria-hidden, focusable="false"
<Check title="Bekreftet" />     // meaningful: role="img" with a <title>
<Check weight="fill" />         // selected or active state`;

const BRAND_LOGO = `import { BrandLogo } from "@elmeragroup/ui/icons";

<BrandLogo brand="fkas" />              // Fjordkraft wordmark
<BrandLogo brand="tkas" variant="mark" />`;

export default function IconsPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="entries">The entries</h2>
      <ul>
        <li>
          <code>@elmeragroup/ui/icons</code> — curated Phosphor adapters, bespoke marks, brand logos and{" "}
          <code>BrandLogo</code>.
        </li>
        <li>
          <code>@elmeragroup/ui/illustrations</code> — brand artwork.
        </li>
        <li>
          <code>@elmeragroup/ui/flags</code> — the generated flag-asset manifest, plus one static SVG per
          two-letter country code.
        </li>
      </ul>
      <p>
        All three are subpath-only and none is re-exported from the package root. There is no{" "}
        <code>Icon</code> namespace, no SVG loader or SVGR requirement, no icon font, no default export and no
        remote-asset mode. Consumers import components.
      </p>

      <h2 id="phosphor-adapters">Phosphor adapters</h2>
      <p>
        Each curated icon is a generated wrapper around a single per-icon Phosphor module, so importing one
        icon costs one icon. The wrapper exists to narrow the weight axis: the library ships{" "}
        <code>regular</code> and <code>fill</code> only, defaulting to <code>regular</code>, with{" "}
        <code>fill</code> reserved for a selected or active state.
      </p>
      <p>
        The adapters are <strong>server-safe</strong> — no <code>&quot;use client&quot;</code> directive, no
        hooks, no icon context — so they render in a server component without pulling it into the client
        graph. They forward <code>ref</code>, <code>className</code>, <code>size</code>, <code>color</code>{" "}
        and the usual SVG attributes.
      </p>
      <p>
        The curated roster is exhaustive and generated from a literal manifest. Adding or removing an icon is
        a public API change and moves the manifest, the generated modules, the tests and a changeset together.
      </p>

      <h2 id="accessibility">Accessible naming</h2>
      <p>
        Every icon and logo takes an optional <code>title</code>, and that one prop decides its semantics:
      </p>
      <ul>
        <li>
          <strong>
            With <code>title</code>
          </strong>{" "}
          — renders <code>role=&quot;img&quot;</code> and an associated <code>&lt;title&gt;</code>. Use this
          when the icon carries meaning on its own.
        </li>
        <li>
          <strong>Without</strong> — renders <code>aria-hidden=&quot;true&quot;</code> and{" "}
          <code>focusable=&quot;false&quot;</code>. A decorative icon must not accidentally acquire an
          accessible name.
        </li>
      </ul>
      <p>
        An icon-only button is a separate concern: the button needs the label, not the glyph, and the types
        enforce that.
      </p>
      <pre>
        <code>{IMPORT}</code>
      </pre>

      <h2 id="sizing-and-colour">Sizing and colour</h2>
      <p>
        Icons size with <code>size</code> and inherit colour from <code>currentColor</code>, so they take the
        colour of the text around them without naming a token. Bespoke artwork keeps its own paint: fixed
        official colours stay fixed, and artwork already drawn in <code>currentColor</code> stays
        consumer-colourable. Neither is remapped onto theme role tokens.
      </p>

      <h2 id="logos">Logos</h2>
      <p>
        Each brand logo accepts <code>variant=&quot;full&quot;</code> (default) or{" "}
        <code>variant=&quot;mark&quot;</code>. <code>BrandLogo</code> takes a brand code and resolves the
        right one for you — useful when the brand is a runtime value rather than a literal.
      </p>
      <pre>
        <code>{BRAND_LOGO}</code>
      </pre>
      <p>
        <code>BrandLogo</code> is exhaustive over every brand code and reads no context: pass the brand
        explicitly. Its accessible name defaults to the brand&apos;s display name, and <code>elma</code>{" "}
        renders that name as text rather than inventing a mark.
      </p>

      <h2 id="flags">Flags</h2>
      <p>
        Flags are packaged SVG files, not emoji: every operating system gets the same artwork. They live
        outside the JavaScript budget and are never inlined, guarded instead by file hashes and an aggregate
        raw-byte ceiling. Four territories have phone-number entries but no pinned SVG and are excluded from
        flag-bearing country state rather than being given a misleading substitute.
      </p>
    </DocsPage>
  );
}
