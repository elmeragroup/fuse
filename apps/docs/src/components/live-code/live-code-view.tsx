"use client";

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Check } from "@elmeragroup/fuse/icons";
import { Popover } from "@elmeragroup/fuse/popover";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";

import { editedSource, planSite } from "../../lib/live-code/edits";
import type { FrameEdits, PropValue } from "../../lib/live-code/edits";
import { allowedValues } from "../../lib/live-code/schema";
import type { PropSpec } from "../../lib/live-code/schema";
import { findSites } from "../../lib/live-code/sites";
import type { Site } from "../../lib/live-code/sites";
import { CopySourceButton } from "../source-code";
import type { LiveCodeStore, LiveSite, SiteValue } from "./lens";
import { PropControl } from "./prop-control";

const liveCodeView = tv({
  slots: {
    root: "relative isolate border-t border-border bg-card",
    toolbar: "flex h-10 items-center gap-1 border-b border-border/60 ps-4 pe-2",
    file: "text-xs me-auto truncate font-mono text-muted-foreground",
    // Names an edit the stage could not render, which Live code reverted.
    notice: "text-xs truncate text-muted-foreground",
    hint: "text-xs max-sm:hidden pe-1 text-muted-foreground",
    scroll: "max-h-88",
    // A 24px line gives every editable token a 24px target.
    pre: "text-xs m-0 overflow-x-auto bg-card px-4.5 py-3 leading-6 [tab-size:2] text-sh-identifier [&_.sh__line]:block [&_.sh__line]:min-h-[1lh]",
    code: "block min-w-max",
    options: "flex w-48 flex-col p-1",
    option:
      "text-xs ease-out flex h-7 items-center gap-2 rounded-inner px-2 text-start font-mono transition-colors duration-100 outline-none hover:bg-accent focus-visible:bg-accent motion-reduce:transition-none",
    optionCheck: "size-3.5 shrink-0 opacity-0 in-aria-pressed:opacity-100",
    optionDefault: "ms-auto font-sans text-muted-foreground",
    panel: "w-[min(20rem,calc(100vw-2rem))]",
    panelHeader: "flex items-baseline justify-between gap-3",
    panelTitle: "text-sm font-mono",
    panelLine: "text-xs font-mono text-muted-foreground",
    panelRows: "mt-2 flex flex-col",
    empty: "text-xs px-2 py-1.5 text-muted-foreground",
    // The colours of an added prop's name and value when the source marks no token to copy.
    nameToken: "text-sh-property",
    valueToken: "text-sh-string",
    // The editable token, on the buttons the view wraps around marked tokens. A dotted underline
    // marks it clickable, and a changed or added value keeps a static tint, so no state rests on
    // motion. Only colours animate, and not under reduced motion.
    token:
      "ease-out inline-block cursor-pointer rounded-sm leading-6 underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 transition-colors duration-100 outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[open]:bg-accent data-[state=added]:bg-primary/10 data-[state=added]:decoration-primary/70 data-[state=added]:decoration-solid data-[state=changed]:bg-primary/10 data-[state=changed]:decoration-primary/70 data-[state=changed]:decoration-solid data-[state=moved]:hidden motion-reduce:transition-none",
  },
});

const styles = liveCodeView();

/** One row of the tag panel: a prop, with the options its site can take when it is an enum. */
type PanelRow = { readonly spec: PropSpec; readonly options: readonly string[] };

/** What the open popover edits: one prop of a site, or every prop of its tag. */
type OpenToken = {
  readonly anchor: HTMLElement;
  readonly loc: string;
  readonly prop: string | null;
};

/** The original tokens inside each wrapped prop button, restored when its edit is cleared. */
type Originals = WeakMap<Element, readonly Node[]>;

/**
 * The value the stage renders a prop with at a site, read from its instances, or `mixed` where
 * they differ. A prop no instance sets shows its default.
 */
function shownValue(live: LiveSite, spec: PropSpec): SiteValue {
  const value = live.values.get(spec.name) ?? { kind: "one", value: undefined };
  return value.kind === "one" && value.value === undefined ? { kind: "one", value: spec.default } : value;
}

/** The single value a site shows, or `undefined` when it shows none or a mix. */
function currentOf(value: SiteValue): PropValue | undefined {
  return value.kind === "one" ? value.value : undefined;
}

/** Whether a shown value is `option`; a mixed value is none of them. */
function isShown(value: SiteValue, option: PropValue): boolean {
  return value.kind === "one" && value.value === option;
}

/** The props a site passes: those its source writes, and those the reader set. */
function passedProps(site: Site, edits: FrameEdits): ReadonlySet<string> {
  return new Set([
    ...site.attributes.map((attribute) => attribute.name),
    ...(edits.get(site.loc)?.keys() ?? []),
  ]);
}

/**
 * A token span shaped like the highlighter's, copying the class and colour of `like`, the marked
 * token of the same role, or taking `fallback`'s colour when the source has none.
 */
function tokenSpan(text: string, like: Element | null, fallback: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  span.className = like?.className ?? fallback;
  const style = like?.getAttribute("style");
  if (style !== null && style !== undefined) span.setAttribute("style", style);
  return span;
}

/** The attribute `text` as highlighted tokens: the name and `=` like `name`, the value like `value`. */
function attributeTokens(text: string, code: HTMLElement): readonly Node[] {
  const name = code.querySelector('[data-lens-role="name"]');
  const value = code.querySelector('[data-lens-role="value"]');
  const equals = text.indexOf("=");
  if (equals === -1) return [tokenSpan(text, name, styles.nameToken())];
  return [
    tokenSpan(text.slice(0, equals + 1), name, styles.nameToken()),
    tokenSpan(text.slice(equals + 1), value, styles.valueToken()),
  ];
}

/**
 * An editable token's button. A prop's button is named by the attribute it shows, so its name
 * follows each edit; a tag name's is named for what it opens, such as "Button props".
 */
function tokenButton(loc: string, prop: string | null, tagLabel: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = styles.token();
  button.dataset.lensSite = loc;
  button.setAttribute("aria-haspopup", "dialog");
  if (prop === null) button.setAttribute("aria-label", tagLabel);
  else button.dataset.lensProp = prop;
  return button;
}

/**
 * Wraps the marked tokens of every rendered site in buttons: one for the tag name, which edits all
 * of the part's props, and one per written attribute the part can set. An attribute whose tokens
 * span lines stays as text.
 */
function wrapTokens(code: HTMLElement, sites: ReadonlyMap<string, LiveSite>, originals: Originals): void {
  const groups = new Map<string, Element[]>();
  for (const token of code.querySelectorAll("[data-lens-site]")) {
    if (token.closest("button") !== null) continue;
    const loc = token.getAttribute("data-lens-site") ?? "";
    const prop = token.getAttribute("data-lens-prop");
    // Type arguments and spreads are not props the reader sets, and stay text.
    const role = token.getAttribute("data-lens-role");
    if (role === "type" || role === "spread") continue;
    const live = sites.get(loc);
    if (live === undefined) continue;
    if (prop !== null && !live.schema.some((spec) => spec.name === prop)) continue;
    const key = `${loc}\u0000${prop ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), token]);
  }
  for (const tokens of groups.values()) {
    const first = tokens[0];
    if (first === undefined || tokens.some((token) => token.parentNode !== first.parentNode)) continue;
    const loc = first.getAttribute("data-lens-site") ?? "";
    const prop = first.getAttribute("data-lens-prop");
    const text = tokens.map((token) => token.textContent).join("");
    const button = tokenButton(loc, prop, `${text} props`);
    first.before(button);
    button.append(...tokens);
    originals.set(
      button,
      tokens.map((token) => token.cloneNode(true))
    );
  }
}

/** The last marked token of a site with the given role, such as its last spread. */
function lastToken(code: HTMLElement, loc: string, role: string): Element | null {
  const tokens = code.querySelectorAll(`[data-lens-site="${loc}"][data-lens-role="${role}"]`);
  return tokens.length > 0 ? tokens.item(tokens.length - 1) : null;
}

/**
 * The token of one added prop: a space and its button, kept by site and prop across edits. An
 * edit updates the button's content in place, so focus and an open popover stay on it.
 */
function addedToken(holder: Element, loc: string, name: string): HTMLButtonElement {
  const existing = holder.querySelector<HTMLButtonElement>(`button[data-lens-prop="${CSS.escape(name)}"]`);
  if (existing !== null) return existing;
  const wrapper = document.createElement("span");
  wrapper.dataset.lensAddedProp = name;
  const button = tokenButton(loc, name, "");
  button.dataset.state = "added";
  wrapper.append(document.createTextNode(" "), button);
  holder.append(wrapper);
  return button;
}

/**
 * Draws the frame's edits into the wrapped tokens, and the props each site gains where the
 * serializer writes them: after the last spread, or the type arguments, or the tag name. A
 * written prop that a later spread would override moves there too, and its own token hides.
 */
function drawEdits(code: HTMLElement, sites: readonly Site[], edits: FrameEdits, originals: Originals): void {
  for (const site of sites) {
    const plan = planSite(site, edits.get(site.loc));
    const loc = CSS.escape(site.loc);
    for (const button of code.querySelectorAll<HTMLButtonElement>(
      `button[data-lens-site="${loc}"][data-lens-prop]:not([data-state="added"])`
    )) {
      const text = plan.attributes.get(button.dataset.lensProp ?? "");
      const original = originals.get(button) ?? [];
      button.replaceChildren(
        ...(text === undefined || text === null
          ? original.map((node) => node.cloneNode(true))
          : attributeTokens(text, code))
      );
      if (text === undefined) delete button.dataset.state;
      else button.dataset.state = text === null ? "moved" : "changed";
    }
    const tag = code.querySelector(`button[data-lens-site="${loc}"]:not([data-lens-prop])`);
    if (tag === null) continue;
    let holder = code.querySelector(`[data-lens-added="${loc}"]`);
    if (holder === null) {
      holder = document.createElement("span");
      holder.setAttribute("data-lens-added", site.loc);
      (lastToken(code, loc, "spread") ?? lastToken(code, loc, "type") ?? tag).after(holder);
    }
    const kept = new Set(plan.added.map(({ name }) => name));
    for (const wrapper of holder.querySelectorAll<HTMLElement>("[data-lens-added-prop]")) {
      if (!kept.has(wrapper.dataset.lensAddedProp ?? "")) wrapper.remove();
    }
    // Edit order only grows at its end, so new tokens append and kept ones never move.
    for (const { name, text } of plan.added) {
      addedToken(holder, site.loc, name).replaceChildren(...attributeTokens(text, code));
    }
  }
}

type LiveCodeViewProps = {
  /** The frame's store, shared with its stage. */
  store: LiveCodeStore;
  /** The demo's title, which names the code toolbar. */
  title: string;
  /** The demo file name, shown in the toolbar. */
  file: string;
  /** The demo's source. */
  sourceText: string;
  /** The highlighted, site-marked markup from `/demo-source`, or `null` while it loads. */
  html: string | null;
};

/**
 * A component demo's Code view: the demo's source beneath its stage, with the props of every part
 * the stage rendered editable in place.
 *
 * The server marks the tokens of each site (`highlightLiveSource`), and this view wraps those of
 * the sites that rendered in buttons. A prop's button opens its options; a tag name's opens every
 * prop the part can set. An edit lands in the frame's store, where the stage's lensed parts read it,
 * and is drawn into the tokens here, so the stage and the code change together. Reset drops every
 * edit, and Copy copies the edited source, written by the same plan the tokens draw.
 */
export function LiveCodeView({ store, title, file, sourceText, html }: LiveCodeViewProps): ReactElement {
  const edits = useSyncExternalStore(store.subscribe, store.getEdits, store.getEdits);
  const live = useSyncExternalStore(store.subscribe, store.getSites, store.getSites);
  const notice = useSyncExternalStore(store.subscribe, store.getNotice, store.getNotice);
  const sites = useMemo(() => findSites(sourceText), [sourceText]);
  const code = useRef<HTMLElement>(null);
  const originals = useRef<Originals>(new WeakMap());
  const [open, setOpen] = useState<OpenToken | null>(null);

  // The view owns this markup. It sets it once per source, then edits it in place.
  useLayoutEffect(() => {
    const element = code.current;
    if (element === null) return;
    if (html === null) element.textContent = sourceText;
    else element.innerHTML = html;
    originals.current = new WeakMap();
  }, [html, sourceText]);

  useLayoutEffect(() => {
    const element = code.current;
    if (element === null || html === null) return;
    wrapTokens(element, live, originals.current);
    drawEdits(element, sites, edits, originals.current);
    // A prop that moved after a spread is edited through its token there, and a prop whose
    // edit the reader cleared takes its token, the popover's anchor, with it.
    setOpen((current) => {
      if (current === null) return null;
      if (current.anchor.dataset.state === "moved" && current.prop !== null) {
        const moved = element.querySelector<HTMLButtonElement>(
          `[data-lens-added="${CSS.escape(current.loc)}"] button[data-lens-prop="${CSS.escape(current.prop)}"]`
        );
        return moved === null ? null : { ...current, anchor: moved };
      }
      return current.anchor.isConnected ? current : null;
    });
  }, [html, live, sites, edits]);

  /** Closes the popover and clears the open token's highlight. */
  function close(): void {
    code.current?.querySelector("[data-open]")?.removeAttribute("data-open");
    setOpen(null);
  }

  function choose(event: MouseEvent<HTMLElement>): void {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("button[data-lens-site]");
    if (button === null) return;
    code.current?.querySelector("[data-open]")?.removeAttribute("data-open");
    button.dataset.open = "";
    setOpen({
      anchor: button,
      loc: button.dataset.lensSite ?? "",
      prop: button.dataset.lensProp ?? null,
    });
  }

  const openSite = open === null ? undefined : sites.find((site) => site.loc === open.loc);
  const openLive = open === null ? undefined : live.get(open.loc);
  const openSchema = openLive?.schema;
  const openSpec = open?.prop === null ? undefined : openSchema?.find((spec) => spec.name === open?.prop);
  // The site's own value stays on offer, so a written prop always lists at least it.
  const openOptions =
    openSpec?.kind === "enum" && openSite !== undefined && openLive !== undefined
      ? allowedValues(openSpec, passedProps(openSite, edits), currentOf(shownValue(openLive, openSpec)))
      : [];
  // The tag panel's rows, each enum with the options its site can take. An enum with none to
  // offer is left out rather than shown as an empty control.
  const panelRows =
    openSite === undefined || openLive === undefined
      ? []
      : (openSpec === undefined ? openLive.schema : [openSpec]).flatMap((spec): PanelRow[] => {
          if (spec.kind === "boolean") return [{ spec, options: [] }];
          const options = allowedValues(
            spec,
            passedProps(openSite, edits),
            currentOf(shownValue(openLive, spec))
          );
          return options.length === 0 ? [] : [{ spec, options }];
        });
  const dirty = edits.size > 0;
  const editable = html !== null && live.size > 0;

  return (
    <div className={styles.root()}>
      <div role="group" aria-label={`${title} code`} className={styles.toolbar()}>
        <span className={styles.file()}>{file}</span>
        {/* A live region from the start, so the notice of a rejected edit is announced. */}
        <span role="status" className={styles.notice()}>
          {notice}
        </span>
        {editable && !dirty && notice === null ? (
          <span className={styles.hint()}>Select a prop to try it</span>
        ) : null}
        {dirty ? (
          <Button variant="ghost" size="xs" onClick={() => store.reset()}>
            Reset
          </Button>
        ) : null}
        <CopySourceButton
          sourceText={editedSource(sourceText, sites, edits)}
          label="Copy code"
          copiedStatus="Code copied to the clipboard"
        />
      </div>
      <ScrollArea.Root className={styles.scroll()}>
        {/* Clicks land on the token buttons the view adds to the markup; native buttons carry the keys. */}
        <pre className={styles.pre()} onClick={choose}>
          <code ref={code} className={styles.code()} />
        </pre>
      </ScrollArea.Root>
      <Popover.Root
        open={open !== null && openSite !== undefined && openLive !== undefined}
        onOpenChange={(next) => {
          if (!next) close();
        }}>
        {open !== null && openSite !== undefined && openLive !== undefined && openSchema !== undefined ? (
          <Popover.Content
            anchor={open.anchor}
            finalFocus={() => open.anchor}
            side="bottom"
            align="start"
            sideOffset={6}
            // The option list has no title of its own, so its name says what it sets.
            aria-label={openSpec?.kind === "enum" ? `${openSite.part} ${openSpec.name}` : undefined}
            className={openSpec?.kind === "enum" ? styles.options() : styles.panel()}>
            {openSpec?.kind === "enum" ? (
              <div role="group" aria-label={openSpec.name}>
                {openOptions.length === 0 ? <p className={styles.empty()}>No value fits this site.</p> : null}
                {openOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isShown(shownValue(openLive, openSpec), option)}
                    className={styles.option()}
                    onClick={() => {
                      store.set(open.loc, openSpec.name, option);
                      close();
                    }}>
                    <Check aria-hidden className={styles.optionCheck()} />
                    {option}
                    {option === openSpec.default && option !== "default" ? (
                      <span className={styles.optionDefault()}>default</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className={styles.panelHeader()}>
                  <Popover.Title className={styles.panelTitle()}>{`<${openSite.part}>`}</Popover.Title>
                  <span className={styles.panelLine()}>line {open.loc.split(":")[0]}</span>
                </div>
                <div className={styles.panelRows()}>
                  {panelRows.map(({ spec, options }) => (
                    <PropControl
                      key={spec.name}
                      spec={spec}
                      options={options}
                      value={shownValue(openLive, spec)}
                      edited={edits.get(open.loc)?.has(spec.name) ?? false}
                      onChange={(value) => store.set(open.loc, spec.name, value)}
                    />
                  ))}
                </div>
              </>
            )}
          </Popover.Content>
        ) : null}
      </Popover.Root>
    </div>
  );
}
