/**
 * Where an element that sets border sides or corners by their flow-relative names lays out other than
 * left to right in horizontal lines, which puts those edges elsewhere than the capture reads them
 * (`otherFlow`). The capture's page function calls {@link flowObserver} with the root's elements and
 * reads the flow in each mode it stamps, so `flowObserver` is passed to the page as its source and
 * reads nothing outside its own body.
 */
import { FLOW_EDGES, FLOW_RELATIVE_NAMES } from "./winners.ts";
import type { FlowRelativeEdges } from "./winners.ts";

/** An element of a root's tree, by its path from the root. */
type PathElement = { readonly element: Element; readonly path: string };

/** An element that sets border sides or corners by their flow-relative names, by path, with those edges. */
export type FlowRelativeElement = {
  readonly path: string;
  readonly edges: readonly FlowRelativeEdges[];
};

/** What the page passes {@link flowObserver}, as JSON. */
export type FlowArgument = {
  /** The elements the capture's cascade read setting edges by their flow-relative names, winning or not. */
  readonly relative: readonly FlowRelativeElement[];
  /** Each edge with the pattern of the properties that set it so, as its source (`FLOW_RELATIVE_NAMES`). */
  readonly names: readonly (readonly [FlowRelativeEdges, string])[];
};

/**
 * The argument the page passes {@link flowObserver}.
 *
 * @param relative - The elements the capture's cascade read setting edges by their flow-relative names.
 * @returns The elements, with each edge's pattern as its source.
 */
export function flowArgument(relative: readonly FlowRelativeElement[]): FlowArgument {
  return { relative, names: FLOW_EDGES.map((edges) => [edges, FLOW_RELATIVE_NAMES[edges].source] as const) };
}

/** What {@link flowObserver} reads of a root's elements in the page. */
export type FlowObserver = {
  /**
   * Whether the page reads the flow in every mode: some rule of its sheets or some `style` attribute
   * sets `direction` or `writing-mode`, a sheet cannot be read, or an element lays out other than
   * left to right in horizontal lines in the page's own mode. Otherwise only a `dir` attribute and
   * the user agent's rules turn a box, alike in every mode, and none does.
   */
  readonly sweeps: boolean;
  /** Read each element's flow in the mode the page stamps. */
  readonly read: () => void;
  /** The elements that laid out otherwise in a mode {@link FlowObserver.read} read, with the edges each sets so. */
  readonly turned: () => readonly FlowRelativeElement[];
};

/**
 * Observe a root's elements for `otherFlow`. An element's edges are those `flowRelative` gives it,
 * and those of each rule of the page's sheets, or of its `style` attribute, that sets border sides or
 * corners by their flow-relative names and matches it in some mode. A rule of one mode can turn a box
 * and set a logical corner on it, as `[data-theme="dark"] .x { direction: rtl;
 * border-start-start-radius: 8px }` does, which the capture's read of the page's own mode misses. A
 * rule under a media query the page does not match, as `@media print`, a sheet's or an `@import`'s
 * included, applies in no mode the page stamps, so it counts for nothing. A sheet the page cannot read
 * counts as setting every edge, and a rule whose selector the page cannot match on its own, as a
 * nested rule or the declarations of an at-rule nested in one, as matching every element. Runs in the
 * page.
 *
 * @param elements - The root's elements.
 * @param argument - The elements that set edges by their flow-relative names, and the patterns.
 * @returns The observer.
 */
export function flowObserver(elements: readonly PathElement[], argument: FlowArgument): FlowObserver {
  const { relative: flowRelative, names } = argument;
  const patterns = names.map(([edges, source]) => [edges, new RegExp(source)] as const);
  const edgesOf = (style: CSSStyleDeclaration): Set<FlowRelativeEdges> => {
    const edges = new Set<FlowRelativeEdges>();
    for (let index = 0; index < style.length; index += 1) {
      const name = style.item(index);
      for (const [edge, pattern] of patterns) {
        if (pattern.test(name)) {
          edges.add(edge);
        }
      }
    }
    return edges;
  };
  const turnsFlow = (style: CSSStyleDeclaration): boolean =>
    style.getPropertyValue("direction") !== "" || style.getPropertyValue("writing-mode") !== "";
  // A media query list of no query, as a sheet without a `media` attribute holds, matches every page.
  const applies = (media: MediaList | undefined): boolean =>
    media === undefined || media.mediaText === "" || matchMedia(media.mediaText).matches;
  // Each applying rule that sets edges by their flow-relative names, with its selector, or none for a
  // rule nested in another or in an `@scope`, whose selector the page cannot match on its own, and for
  // any other rule that holds declarations, as the declarations an at-rule nested in a style rule
  // holds (`CSSNestedDeclarations`) or a keyframe.
  const rules: { readonly selector: string | undefined; readonly edges: ReadonlySet<FlowRelativeEdges> }[] =
    [];
  let turns = false;
  let unread = false;
  const readSheet = (sheet: CSSStyleSheet): void => {
    if (!applies(sheet.media)) {
      return;
    }
    try {
      readRules(sheet.cssRules, false);
    } catch {
      unread = true;
    }
  };
  const readRules = (list: CSSRuleList, relative: boolean): void => {
    for (const rule of list) {
      if (rule instanceof CSSImportRule) {
        if (rule.styleSheet === null) {
          unread ||= applies(rule.media);
        } else if (applies(rule.media)) {
          readSheet(rule.styleSheet);
        }
        continue;
      }
      if (rule instanceof CSSMediaRule && !applies(rule.media)) {
        continue;
      }
      if ("style" in rule && rule.style instanceof CSSStyleDeclaration) {
        turns ||= turnsFlow(rule.style);
        const edges = edgesOf(rule.style);
        const selector = rule instanceof CSSStyleRule && !relative ? rule.selectorText : undefined;
        if (edges.size > 0) {
          rules.push({ selector, edges });
        }
      }
      const scoped = rule instanceof CSSStyleRule || rule instanceof CSSScopeRule;
      if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
        readRules(rule.cssRules, relative || scoped);
      }
    }
  };
  for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
    readSheet(sheet);
  }
  for (const element of document.querySelectorAll("[style]")) {
    if (element instanceof HTMLElement || element instanceof SVGElement) {
      turns ||= turnsFlow(element.style);
    }
  }
  const leftToRight = (element: Element): boolean => {
    const style = getComputedStyle(element);
    return style.direction === "ltr" && style.writingMode === "horizontal-tb";
  };
  const every = patterns.map(([edge]) => edge);
  const edgesAt = new Map(flowRelative.map(({ path, edges }) => [path, edges]));
  const flowing = elements.map((each) => ({
    ...each,
    turned: false,
    edges: new Set<FlowRelativeEdges>(edgesAt.get(each.path) ?? []),
  }));
  const matches = (element: Element, selector: string | undefined): boolean => {
    try {
      return selector === undefined || element.matches(selector);
    } catch {
      return true;
    }
  };
  const read = (): void => {
    for (const each of flowing) {
      if (leftToRight(each.element)) {
        continue;
      }
      each.turned = true;
      const own =
        each.element instanceof HTMLElement || each.element instanceof SVGElement
          ? [...edgesOf(each.element.style)]
          : [];
      const matched = rules.flatMap((rule) => (matches(each.element, rule.selector) ? [...rule.edges] : []));
      for (const edge of [...own, ...matched, ...(unread ? every : [])]) {
        each.edges.add(edge);
      }
    }
  };
  return {
    sweeps: turns || unread || !elements.every(({ element }) => leftToRight(element)),
    read,
    turned: () =>
      flowing.flatMap(({ path, turned, edges }) =>
        turned && edges.size > 0 ? [{ path, edges: [...edges].toSorted() }] : []
      ),
  };
}
