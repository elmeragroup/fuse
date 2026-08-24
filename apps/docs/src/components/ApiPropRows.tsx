"use client";

/**
 * The expandable prop rows of one part's API reference (docs-site.md §8).
 *
 * Ported from Base UI's docs site — `docs/src/components/ReferenceTable/ReferenceAccordion.tsx`,
 * `docs/src/components/Accordion.tsx` and `docs/src/components/DescriptionList.tsx` in
 * https://github.com/mui/base-ui (MIT) — for its mechanics only; every style here is ours.
 * What is borrowed: native `details`/`summary` rows under a fake header row, one DOM tree
 * whose columns appear as the viewport widens, `grid-template-columns: subgrid` so the
 * expanded panel's terms line up with the closed row's cells, opening a row whose id the
 * URL hash names, and not toggling a row when the click was the end of a text selection.
 * What is deliberately not ported: type-reference hover popovers, the `:target`-revealed
 * additional-types blocks, the hook/class/raw branches, and analytics on expansion.
 */

import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactElement } from "react";

import type { ApiPropView } from "../lib/api-row";
import { NO_DEFAULT } from "../lib/api-row";
import "./ApiReference.css";
import { InlineCode } from "./InlineCode";

export type ApiPropRowsProps = {
  /** Display name of the part these props belong to; only the group's label reads it. */
  partName: string;
  props: readonly ApiPropView[];
};

/**
 * A `details` row that opens itself when the page's hash names it.
 *
 * Chrome opens a `details` whose descendant matches the hash on its own; Safari and Firefox
 * do not, so the row watches the hash and opens itself. `open` stays uncontrolled-ish — it is
 * forced only while the hash matches, and the native toggle owns it otherwise — so a reader
 * can still close a row they arrived at through its link.
 */
function ApiPropRow({ prop }: { prop: ApiPropView }): ReactElement {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function openOnHash(): void {
      if (window.location.hash.slice(1) === prop.id) {
        setOpen(true);
      }
    }
    openOnHash();
    window.addEventListener("hashchange", openOnHash);
    return () => {
      window.removeEventListener("hashchange", openOnHash);
    };
  }, [prop.id]);

  return (
    <details
      className="ApiRow"
      open={open || undefined}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}>
      <summary
        id={prop.id}
        className="ApiRowTrigger"
        aria-label={prop.label}
        onClick={(event: MouseEvent<HTMLElement>) => {
          // Selecting a type across a row ends in a click on the summary; toggling then
          // would throw away the selection the reader just made.
          if (window.getSelection()?.isCollapsed === false) {
            event.preventDefault();
          }
        }}
        onMouseDown={(event: MouseEvent<HTMLElement>) => {
          // Double- and triple-click select text inside the row rather than toggling it.
          if (!event.defaultPrevented && event.detail > 1) {
            event.preventDefault();
          }
        }}>
        <span className="ApiCell ApiNameCell">
          <code>{prop.name}</code>
          {prop.required ? (
            <sup className="ApiRequired" title="Required">
              *
            </sup>
          ) : null}
        </span>
        <span className="ApiCell ApiTypeCell">
          <code>{prop.closedType}</code>
        </span>
        <span className="ApiCell ApiDefaultCell">
          {prop.defaultValue === null ? (
            <span className="ApiNoDefault">{NO_DEFAULT}</span>
          ) : (
            <code>{prop.defaultValue}</code>
          )}
        </span>
        <span className="ApiCell ApiChevronCell" aria-hidden>
          <svg className="ApiChevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" strokeWidth="1.25" />
          </svg>
        </span>
      </summary>
      <div className="ApiPanel">
        <dl className="ApiPanelList">
          <div className="ApiPanelItem">
            <dt>Name</dt>
            <dd>
              <a className="ApiPropLink" href={`#${prop.id}`}>
                <code>{prop.name}</code>
              </a>
              {prop.required ? " · required" : null}
            </dd>
          </div>
          {prop.description === "" ? null : (
            <div className="ApiPanelItem">
              <dt>Description</dt>
              <dd>
                <InlineCode text={prop.description} />
              </dd>
            </div>
          )}
          <div className="ApiPanelItem">
            <dt>Type</dt>
            <dd>
              <pre className="ApiSignature">
                {/* The full printed signature the closed row may have collapsed to one word. */}
                <code dangerouslySetInnerHTML={{ __html: prop.signatureHtml }} />
              </pre>
            </dd>
          </div>
          <div className="ApiPanelItem">
            <dt>Default</dt>
            <dd>
              {prop.defaultValue === null ? (
                <span className="ApiNoDefault">{NO_DEFAULT}</span>
              ) : (
                <code>{prop.defaultValue}</code>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

export function ApiPropRows({ partName, props }: ApiPropRowsProps): ReactElement {
  return (
    <div
      className="ApiRows"
      // The rows are a `div` grid, not a table, and the header row is decorative — so the
      // caption that says what the columns are is the group's name. `role="group"` with a
      // name is announced on entry; the same sentence as a visually-hidden `aria-describedby`
      // target on a plain `div` is not reliably announced at all.
      role="group"
      aria-label={`${partName} props: name, type, default. Each row expands.`}
      // Lets CSS size the offscreen placeholder from the real row count, so a long page's
      // skipped reference blocks do not collapse the scrollbar (`content-visibility: auto`).
      // SAFETY: `CSSProperties` has no index signature for custom properties, and React
      // passes an unknown `--*` key straight through to the inline style attribute.
      style={{ "--api-rows": props.length } as CSSProperties}>
      <div className="ApiHeaderRow" aria-hidden>
        <span className="ApiHeaderCell ApiNameCell">Prop</span>
        <span className="ApiHeaderCell ApiTypeCell">Type</span>
        <span className="ApiHeaderCell ApiDefaultCell">Default</span>
        <span className="ApiHeaderCell ApiChevronCell" />
      </div>
      {props.map((prop) => (
        <ApiPropRow key={prop.name} prop={prop} />
      ))}
    </div>
  );
}
