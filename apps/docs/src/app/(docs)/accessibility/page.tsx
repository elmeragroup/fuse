import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../components/DocsPage";

const HREF = "/accessibility";

export const metadata = pageMetadata(HREF);

export default function AccessibilityPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="conformance-target">Conformance target</h2>
      <p>
        The library <strong>targets WCAG 2.2 AA</strong>. That is a design target, documented per component —{" "}
        <strong>not a conformance claim</strong>. Conformance is a property of a page, and only the app that
        assembles the page can achieve it. The Norwegian and EU legal baseline (EN 301 549) tracks WCAG 2.1
        AA, which 2.2 AA is a strict superset of, so meeting the target keeps a consuming app ahead of the
        legal floor.
      </p>

      <h2 id="responsibility-split">Responsibility split</h2>
      <p>The line between what the library owns and what your app owns is fixed:</p>
      <div className="DocsTableWrap">
        <table className="DocsTable">
          <thead>
            <tr>
              <th scope="col">The library owns</th>
              <th scope="col">Your app owns</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Widget semantics and roles</td>
              <td>
                Page structure: landmarks, heading order, skip links (see{" "}
                <Link href="/quick-start">Quick start</Link>)
              </td>
            </tr>
            <tr>
              <td>Keyboard behaviour and roving focus</td>
              <td>
                <code>lang</code> attributes
              </td>
            </tr>
            <tr>
              <td>Focus visibility</td>
              <td>Focus management across route changes</td>
            </tr>
            <tr>
              <td>Correct-language built-in strings</td>
              <td>Final contrast when composing tokens in non-default pairings</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="keyboard-and-focus">Keyboard &amp; focus</h2>
      <ul>
        <li>
          Focus rings render on <code>:focus-visible</code> only, never bare <code>:focus</code>, always
          through one shared recipe: a two-pixel ring with a mandatory two-pixel offset. The offset keeps the
          brand-independent violet ring legible on coloured fills and pill shapes. No component suppresses,
          recolours or redefines it.
        </li>
        <li>
          Keyboard behaviour inherits base-ui verbatim: arrow-key roving with roving tabindex in composites,
          typeahead where base-ui provides it, <code>Escape</code> dismissing the topmost open overlay only,
          modal overlays trapping focus and returning it to the trigger on close.
        </li>
        <li>
          No component sets a positive <code>tabindex</code>; <code>tabindex={"{-1}"}</code> appears only for
          programmatic focus targets.
        </li>
      </ul>

      <h2 id="labeling">Labeling</h2>
      <p>
        <Link href="/components/field">Field</Link> is the canonical labeling mechanism: it wires{" "}
        <code>id</code>/<code>htmlFor</code>, <code>aria-describedby</code> for the description and error, and
        the error announcement. No control invents its own label wiring.
      </p>
      <p>
        The rule is that <strong>every interactive element has a programmatic name</strong> — via Field,
        visible text content, or an explicit <code>aria-label</code>. Where that is mechanically expressible
        it is enforced in the types: an icon-only <code>Button</code> will not typecheck without an{" "}
        <code>aria-label</code>. There are no dev-mode runtime label warnings.
      </p>

      <h2 id="motion">Motion</h2>
      <p>
        One central <code>prefers-reduced-motion: reduce</code> block in the library stylesheet removes
        transform, translate and scale motion while retaining opacity fades — comprehension-aiding transitions
        survive, movement does not. No component opts out. UI transitions sit in a 150–300 ms ease-out band
        and animate only <code>transform</code> and <code>opacity</code>.
      </p>

      <h2 id="target-size">Target size</h2>
      <p>
        Interactive controls meet WCAG 2.2 AA 2.5.8 Target Size (Minimum): at least{" "}
        <strong>24 × 24 CSS pixels</strong>, through the rendered box or a documented hit-area expansion.
        Density does not change this floor — dense <code>xs</code> Button is a 24 px box, comfortable{" "}
        <code>xs</code> is 32 px.
      </p>

      <h2 id="accepted-deviations">Accepted deviations</h2>
      <p>Documented honestly rather than quietly fixed away:</p>
      <ul>
        <li>
          Default <code>--muted-foreground</code> on white sits at roughly 4.5:1 — at the AA line with no
          margin. Do not use it below 14 px.
        </li>
        <li>
          The brand-independent violet <code>--ring</code> falls below 3:1 non-text contrast against some
          strong external fills; the mandatory ring offset is the mitigation, and a per-brand ring re-mint is
          a roadmap item.
        </li>
        <li>
          <code>feature-foreground</code> is reclassified as accent/decorative. Text on <code>feature</code>{" "}
          panels uses white; body text on feature panels is out of contract.
        </li>
      </ul>
      <p>
        Every text-grade token pair is checked against 4.5:1 across all 20 themes by a generated contrast
        matrix, snapshot-tested next to the token pipeline.
      </p>
    </DocsPage>
  );
}
