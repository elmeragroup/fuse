import type { ESTree, Rule } from "@oxlint/plugins";

import { classesOf, parseClass } from "../class-token.ts";
import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/**
 * An opaque container fill: `bg-card`, `bg-panel`, `bg-popover` or `bg-dialog`, `!`-important or
 * not. An opacity modifier such as `bg-popover/70` is translucent, so the element keeps the surface
 * beneath it and the pattern leaves it out.
 */
const CONTAINER_FILL = /^!?bg-(card|panel|popover|dialog)!?$/u;

/** A `--surface` declaration: a role through `--theme()`, which it captures, or `inherit`. */
const SURFACE = /^!?\[--surface:(?:--theme\(--color-([a-z-]+)\)|inherit)\]!?$/u;

/**
 * The pseudo-classes and pseudo-elements a fill passes through rather than rests in: pointer, focus
 * and form states, and the pseudo-elements nothing rests on. Each is spelled the same as a Tailwind
 * variant (`hover:`, `before:`) and inside an arbitrary selector (`[&:hover]`, `[&::before]`), so one
 * list serves both spellings; `file:` spells `::file-selector-button`, so the list holds both.
 */
const NON_RESTING_PSEUDOS: ReadonlySet<string> = new Set([
  "hover",
  "focus",
  "focus-visible",
  "focus-within",
  "active",
  "visited",
  "target",
  "checked",
  "indeterminate",
  "default",
  "disabled",
  "enabled",
  "required",
  "optional",
  "valid",
  "invalid",
  "user-valid",
  "user-invalid",
  "in-range",
  "out-of-range",
  "placeholder-shown",
  "autofill",
  "read-only",
  "read-write",
  "open",
  "inert",
  "before",
  "after",
  "placeholder",
  "file",
  "file-selector-button",
  "marker",
  "selection",
  "first-line",
  "first-letter",
  "backdrop",
  "details-content",
]);

/**
 * The `data-*` attributes that publish a state, named without their prefix. The list is closed:
 * every other attribute (`data-slot`, `data-side`, `data-align`, `data-inset`, …) names structure,
 * so a fill under it is the element's resting look and states its surface. It holds the state
 * attributes Base UI publishes (the `*DataAttributes` enums in `@base-ui/react`), `data-state`, and
 * the state flags Fuse sets itself: ConfirmButton's `data-armed`, FileUpload's `data-drop-target`,
 * the chart's `data-outgoing` and the Calendar's `data-in-range`, `data-selection-start`,
 * `data-selection-end` and `data-unavailable`.
 */
const DATA_STATES = [
  // Base UI.
  "active",
  "anchor-hidden",
  "checked",
  "closed",
  "complete",
  "current",
  "dirty",
  "disabled",
  "dragging",
  "empty",
  "ending-style",
  "expanded",
  "filled",
  "focused",
  "has-overflow-x",
  "has-overflow-y",
  "has-submenu-open",
  "hidden",
  "highlighted",
  "hovering",
  "indeterminate",
  "instant",
  "invalid",
  "list-empty",
  "loading",
  "nested-dialog-open",
  "nested-drawer-open",
  "nested-drawer-swiping",
  "open",
  "overflow-x-end",
  "overflow-x-start",
  "overflow-y-end",
  "overflow-y-start",
  "panel-open",
  "placeholder",
  "popup-open",
  "pressed",
  "progressing",
  "readonly",
  "required",
  "scrolling",
  "scrubbing",
  "selected",
  "starting-style",
  "swiping",
  "touched",
  "transitioning",
  "trigger-disabled",
  "unchecked",
  "valid",
  "visible",
  // `data-state` and Fuse's own flags.
  "state",
  "armed",
  "drop-target",
  "outgoing",
  "in-range",
  "selection-start",
  "selection-end",
  "unavailable",
];

/**
 * The `aria-*` attributes that publish a state: the WAI-ARIA 1.2 states. It leaves out
 * `aria-hidden`, which Fuse uses as a structural marker (ButtonGroup's
 * `has-[select[aria-hidden=true]:last-child]`), so a fill under it states its surface even though
 * Base UI's `data-hidden` is a state.
 */
const ARIA_STATES = [
  "busy",
  "checked",
  "current",
  "disabled",
  "expanded",
  "grabbed",
  "invalid",
  "pressed",
  "selected",
];

/**
 * Every state attribute, named with its namespace so `data-hidden` and `aria-hidden` resolve
 * apart. The list is closed: any attribute it leaves out names structure.
 */
const STATE_ATTRIBUTES: ReadonlySet<string> = new Set([
  ...DATA_STATES.map((name) => `data-${name}`),
  ...ARIA_STATES.map((name) => `aria-${name}`),
]);

/** Each pseudo-class or pseudo-element an arbitrary selector names, such as `hover` in `[&:hover]`. */
const SELECTOR_PSEUDO = /::?([\w-]+)/gu;

/**
 * A native state attribute inside an arbitrary selector, such as `[&[open]]`: the attribute form of
 * the `open`, `disabled`, `inert`, `checked`, `required` and `read-only` pseudo-classes, and
 * `selected`.
 */
const NATIVE_STATE_ATTRIBUTE = /\[(?:open|disabled|inert|checked|selected|required|readonly)(?=[\]=~|^$*])/u;

/**
 * A named attribute variant, `data-checked` or `data-[variant=card]`, and the namespace and
 * attribute it names.
 */
const ATTRIBUTE_VARIANT = /^(data|aria)-\[?([\w-]+)/u;

/** Each attribute an arbitrary selector reads, such as `data-slot` in `[&_[data-slot=card]]`. */
const SELECTOR_ATTRIBUTE = /\[((?:data|aria)-[\w-]+)/gu;

/** A prefix that applies another variant to a relative element: `group-hover/tabs`, `in-data-x`, `not-…`. */
const RELATIVE_PREFIX = /^(?:group|peer|in|not|has)-/u;

/** Whether an arbitrary selector reads a state or targets a pseudo-element. */
function selectorIsNonResting(selector: string): boolean {
  if (NATIVE_STATE_ATTRIBUTE.test(selector)) return true;
  const pseudos = Array.from(selector.matchAll(SELECTOR_PSEUDO), ([, name]) => name ?? "");
  const attributes = Array.from(selector.matchAll(SELECTOR_ATTRIBUTE), ([, name]) => name ?? "");
  return (
    pseudos.some((name) => NON_RESTING_PSEUDOS.has(name)) ||
    attributes.some((name) => STATE_ATTRIBUTES.has(name))
  );
}

/**
 * Whether a variant names a state or a pseudo-element, through itself or the variant a relative
 * prefix applies.
 */
function isNonResting(variant: string): boolean {
  const named = variant.replace(/\/[\w-]+$/u, "");
  if (named.startsWith("[")) return selectorIsNonResting(named);
  if (NON_RESTING_PSEUDOS.has(named) || named.startsWith("enabled-") || named === "disabled-state") {
    return true;
  }
  const attribute = ATTRIBUTE_VARIANT.exec(named);
  if (attribute !== null) return STATE_ATTRIBUTES.has(`${attribute[1]}-${attribute[2]}`);
  return RELATIVE_PREFIX.test(named) && isNonResting(named.replace(RELATIVE_PREFIX, ""));
}

/**
 * A Fuse container that paints a container role as its resting fill states that fill as
 * `--surface` in the same class string, under the same variants: `bg-card
 * [--surface:--theme(--color-card)]`. Chart cut-outs, the Field separator label and the inline
 * TextField read `--surface`, so a container that leaves it out shows them the wrong colour. A
 * container that passes its host's surface through states `[--surface:inherit]`. Beside either,
 * `fuse/surface-muted-foreground` requires the muted text paired with that surface.
 *
 * A fill under a state variant (`hover:`, `[&:hover]`, `data-checked:`, `aria-selected:`,
 * `enabled-*`, `group-hover/…:` and the like) or on a pseudo-element (`before:`, `[&::before]`) is
 * not a resting fill, and an opacity-modified fill such as `bg-popover/70` is translucent, so it
 * keeps the surface beneath it; the rule leaves all three alone. Only a listed state attribute
 * makes a fill a state face: any other attribute, such as `data-slot`, `data-variant` or
 * `data-side`, names structure, so a fill under it states its surface. A control
 * that borrows a container colour, such as a checkbox box or a badge, carries a disable comment with
 * its reason.
 */
export const containerSurface: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require a container fill to state its colour as `--surface`." },
    messages: {
      missing:
        "`{{token}}` paints a container fill without stating it as `--surface`. Add `{{prefix}}[--surface:--theme(--color-{{role}})]` with its `{{prefix}}[--surface-muted-foreground:…]`, or `{{prefix}}[--surface:inherit]` and `{{prefix}}[--surface-muted-foreground:inherit]` to pass the host's surface through.",
      mismatch:
        "`{{token}}` paints the {{role}} fill but states `--surface` as {{surface}}. State `{{prefix}}[--surface:--theme(--color-{{role}})]`.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const check = (node: ESTree.Node, text: string): void => {
      // Each resting fill, and the surface each variant prefix states, keyed by the full prefix so
      // a fill pairs only with a surface under the same variants.
      const fills: Array<{ token: string; prefix: string; role: string }> = [];
      const surfaces = new Map<string, string>();
      for (const token of classesOf(text)) {
        const { variants, utility } = parseClass(token);
        const prefix = token.slice(0, token.length - utility.length);
        const surface = SURFACE.exec(utility);
        if (surface !== null) surfaces.set(prefix, surface[1] ?? "inherit");
        const role = CONTAINER_FILL.exec(utility)?.[1];
        if (role !== undefined && !variants.some((variant) => isNonResting(variant))) {
          fills.push({ token, prefix, role });
        }
      }
      for (const { token, prefix, role } of fills) {
        const surface = surfaces.get(prefix);
        if (surface === role || surface === "inherit") continue;
        context.report({
          node,
          messageId: surface === undefined ? "missing" : "mismatch",
          data: { token, prefix, role, surface: surface ?? "" },
        });
      }
    };
    return {
      Literal(node) {
        const text = staticText(node);
        if (text !== undefined) check(node, text);
      },
      // One class string, its chunks split at each substitution so a class never spans one.
      TemplateLiteral(node) {
        check(node, node.quasis.map((chunk) => staticText(chunk)).join(" "));
      },
    };
  },
};
