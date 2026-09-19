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
import type { MouseEvent, ReactElement } from "react";

import type { ApiPropView } from "../lib/api-row";
import { NO_DEFAULT } from "../lib/api-row";
import { ApiRows } from "./api-rows";
import { DocsInlineCode } from "./docs-inline-code";
import { InlineCode } from "./inline-code";

export type ApiPropRowsProps = {
  /** Complete accessible name for this source group; only the group's label reads it. */
  partName: string;
  props: readonly ApiPropView[];
};

type ApiPropRowProps = {
  prop: ApiPropView;
  /** Forced open because the page's hash names this row. */
  open: boolean;
  /** The reader closed the row the hash had opened; the group stops forcing it. */
  onClose: () => void;
};

/**
 * One `details` row. `open` is forced only while the hash names the row, and the native
 * toggle owns it otherwise — so a reader can still close a row they arrived at through its
 * link.
 */
function ApiPropRow({ prop, open, onClose }: ApiPropRowProps): ReactElement {
  return (
    <ApiRows.Row
      open={open || undefined}
      onToggle={(event) => {
        if (open && !event.currentTarget.open) {
          onClose();
        }
      }}>
      <ApiRows.Summary
        id={prop.id}
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
        <ApiRows.Cell column="name" code={prop.name}>
          {prop.required ? <ApiRows.Required title="Required">*</ApiRows.Required> : null}
        </ApiRows.Cell>
        <ApiRows.Cell column="type" code={prop.closedType} />
        <ApiRows.Cell column="default" code={prop.defaultValue}>
          {prop.defaultValue === null ? <ApiRows.NoDefault>{NO_DEFAULT}</ApiRows.NoDefault> : null}
        </ApiRows.Cell>
        <ApiRows.ChevronCell aria-hidden>
          <ApiRows.Chevron />
        </ApiRows.ChevronCell>
      </ApiRows.Summary>
      <ApiRows.Panel>
        <ApiRows.PanelList>
          <ApiRows.PanelItem>
            <ApiRows.Term>Name</ApiRows.Term>
            <ApiRows.Definition>
              <a href={`#${prop.id}`}>
                <DocsInlineCode>{prop.name}</DocsInlineCode>
              </a>
              {prop.required ? " · required" : null}
            </ApiRows.Definition>
          </ApiRows.PanelItem>
          {prop.description === "" ? null : (
            <ApiRows.PanelItem>
              <ApiRows.Term>Description</ApiRows.Term>
              <ApiRows.Definition>
                <InlineCode text={prop.description} />
              </ApiRows.Definition>
            </ApiRows.PanelItem>
          )}
          <ApiRows.PanelItem>
            <ApiRows.Term>Type</ApiRows.Term>
            <ApiRows.Definition>
              {/*
                The full printed signature the closed row may have collapsed to one word —
                highlighted on the server and handed down as a finished element, so this
                client module never imports the highlighter (`api-row.ts`).
              */}
              {prop.signature}
            </ApiRows.Definition>
          </ApiRows.PanelItem>
          <ApiRows.PanelItem>
            <ApiRows.Term>Default</ApiRows.Term>
            <ApiRows.Definition>
              {prop.defaultValue === null ? (
                <ApiRows.NoDefault>{NO_DEFAULT}</ApiRows.NoDefault>
              ) : (
                <DocsInlineCode>{prop.defaultValue}</DocsInlineCode>
              )}
            </ApiRows.Definition>
          </ApiRows.PanelItem>
        </ApiRows.PanelList>
      </ApiRows.Panel>
    </ApiRows.Row>
  );
}

/** The row id the page's hash names, or `null` when it names nothing. */
function hashRowId(): string | null {
  const id = window.location.hash.slice(1);
  return id === "" ? null : id;
}

export function ApiPropRows({ partName, props }: ApiPropRowsProps): ReactElement {
  // Chrome opens a `details` whose descendant the hash targets on its own; Safari and
  // Firefox do not, so the group watches the hash and opens the named row. The group holds
  // that one id and registers one `hashchange` listener for all of its rows — a long API
  // page mounts hundreds of rows, and a listener per row is that many callbacks the
  // browser walks on every in-page navigation.
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    function openFromHash(): void {
      setOpenId(hashRowId());
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  return (
    <ApiRows.Root
      // The rows are a `div` grid, not a table, and the header row is decorative — so the
      // caption that says what the columns are is the group's name. `role="group"` with a
      // name is announced on entry; the same sentence as a visually-hidden `aria-describedby`
      // target on a plain `div` is not reliably announced at all.
      role="group"
      aria-label={`${partName}: name, type, default. Each row expands.`}
      // Lets CSS size the offscreen placeholder from the real row count, so a long page's
      // skipped reference blocks do not collapse the scrollbar (`content-visibility: auto`).
      style={{ "--api-rows": props.length }}>
      <ApiRows.Header aria-hidden>
        <ApiRows.HeaderCell column="prop">Prop</ApiRows.HeaderCell>
        <ApiRows.HeaderCell column="type">Type</ApiRows.HeaderCell>
        <ApiRows.HeaderCell column="default">Default</ApiRows.HeaderCell>
        <ApiRows.ChevronCell />
      </ApiRows.Header>
      {props.map((prop) => (
        <ApiPropRow
          key={prop.name}
          prop={prop}
          open={openId === prop.id}
          onClose={() => {
            setOpenId(null);
          }}
        />
      ))}
    </ApiRows.Root>
  );
}
