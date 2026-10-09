import type { DensityRole } from "@elmeragroup/fuse/theme-catalog";

/**
 * Density attribution: which of a part's own properties read a density metric.
 *
 * A probe reads a part's computed values twice: once as rendered, and once with every density
 * metric set to a sentinel length. A property that answers the sentinel reads a density metric
 * through the part's own declaration. Two rules keep the answer the part's own:
 *
 * - Box sizes come from the typed computed value (`computedStyleMap`), not the laid-out box, so a
 *   height or width that only follows the part's children stays `auto` and is never credited.
 * - Font size and line height inherit, so the probe pins the part's parent to its rendered type
 *   for the sentinel read. A part that only inherits its type then keeps it.
 *
 * Every density metric moves under the sentinel, including one that is equal at both densities,
 * so a literal length never passes for a metric of the same size.
 */

/** The properties a probe reads on each part, by their CSS names. */
export const PROBED_PROPERTIES = [
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "row-gap",
  "column-gap",
  "height",
  "width",
  "min-height",
  "min-width",
  "font-size",
  "line-height",
] as const;

/** One probed property. */
export type ProbedProperty = (typeof PROBED_PROPERTIES)[number];

/** A part's computed value for each probed property, serialized; a missing one reads as empty. */
export type PropertyReading = Readonly<Partial<Record<string, string>>>;

/** A part read as rendered and under the sentinel metrics. */
export type DensityProbe = {
  readonly base: PropertyReading;
  readonly sentinel: PropertyReading;
};

/** The roles whose parts must read a density metric. */
const METRIC_ROLES: ReadonlySet<DensityRole> = new Set(["control", "row", "surface", "label"]);

/**
 * The properties a part owns that read a density metric.
 *
 * @param probe - The part's two readings.
 * @returns The properties whose value changed under the sentinel metrics, in probe order.
 */
export function densityOwnedProperties(probe: DensityProbe): ProbedProperty[] {
  return PROBED_PROPERTIES.filter(
    (property) => (probe.base[property] ?? "") !== (probe.sentinel[property] ?? "")
  );
}

/**
 * How a part breaks its declared role, or `undefined` when it holds. A `control`, `row`,
 * `surface` or `label` part must read at least one density metric of its own; a `layout` or
 * `fixed` part must read none.
 *
 * @param role - The role the part is checked against.
 * @param probe - The part's two readings.
 * @returns A short reason, or `undefined`.
 */
export function roleViolation(role: DensityRole, probe: DensityProbe): string | undefined {
  const owned = densityOwnedProperties(probe);
  if (METRIC_ROLES.has(role)) {
    return owned.length > 0 ? undefined : "reads no density metric of its own";
  }
  return owned.length === 0 ? undefined : `reads a density metric through its ${owned.join(", ")}`;
}

/**
 * The sentinel length of every density metric: its dense px half again, plus 3px. Every metric
 * moves, and none lands on a length a part could plausibly declare as a literal.
 *
 * @param metrics - The density metrics with their dense px.
 * @returns Each custom property, with its leading dashes, mapped to its sentinel length.
 */
export function sentinelLengths(
  metrics: readonly { readonly name: string; readonly px: { readonly dense: number } }[]
): Readonly<Record<string, string>> {
  return Object.fromEntries(metrics.map(({ name, px }) => [`--${name}`, `${String(px.dense * 1.5 + 3)}px`]));
}

/** What a probe of one stage reads. */
export type ProbeOptions = {
  /** Every part in the stage, or every part that appeared on the page since the last probe. */
  readonly scope: "stage" | "unseen";
  /** Each density custom property and its sentinel length. */
  readonly sentinels: Readonly<Record<string, string>>;
  /** The properties to read, `PROBED_PROPERTIES`. */
  readonly properties: readonly string[];
  /** Override keys and the CSS selector each one matches a part with. */
  readonly overrides: readonly { readonly key: string; readonly selector: string }[];
};

/** One rendered part and its probe. */
export type PartReading = {
  readonly slot: string;
  /** The override keys whose selector matches the part, in the order the options list them. */
  readonly overrides: readonly string[];
  readonly probe: DensityProbe;
};

declare global {
  /** Every part a probe has read in this page, so an opened popup's new parts stand apart. */
  var densitySeen: WeakSet<Element> | undefined;
  /** The parts the last probe read, so the suite can wait for an opened popup's to leave. */
  var densityOpened: readonly Element[] | undefined;
}

/**
 * Starts one density pass in the page: stamps `data-density` on the document root and on every
 * demo stage, and counts every part visible now as seen: a stage probe still measures its own
 * parts, and a popup read takes only what an opener reveals, never the docs chrome or a stage
 * not yet probed. A part mounted hidden stays unseen until it shows. It runs in the browser
 * through `page.evaluate`, so it references nothing outside its own body.
 *
 * @param density - The density to stamp.
 */
export function startDensityPass(density: string): void {
  document.documentElement.setAttribute("data-density", density);
  for (const stage of document.querySelectorAll("[data-demo-stage]")) {
    stage.setAttribute("data-density", density);
  }
  const seen = new WeakSet<Element>();
  for (const element of document.querySelectorAll("[data-slot]")) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden") {
      seen.add(element);
    }
  }
  globalThis.densitySeen = seen;
  globalThis.densityOpened = [];
}

/**
 * Whether the page shows a part no probe has measured yet: an opened popup or disclosure. It
 * runs in the browser through `page.waitForFunction`, so it references nothing outside itself.
 *
 * @returns `true` once a visible, unmeasured part is on the page.
 */
export function showsUnmeasuredPart(): boolean {
  const seen = globalThis.densitySeen;
  return [...document.querySelectorAll("[data-slot]")].some((element) => {
    if (seen?.has(element) === true) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
  });
}

/**
 * Probes the parts of one demo stage in the page. It runs in the browser through
 * `locator.evaluate`, so it references nothing outside its own body.
 *
 * Transitions and animations are off for the probe, so a read never catches a value mid-way.
 * The sentinels go inline on the document root and on every demo stage, because a stage rescopes
 * the density metrics and a popup portals out of the stage to the root.
 *
 * @param stage - The demo stage.
 * @param options - What to read and the sentinel lengths.
 * @returns One reading per rendered part, in document order.
 */
export async function probeParts(stage: Element, options: ProbeOptions): Promise<PartReading[]> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
  const seen = (globalThis.densitySeen ??= new WeakSet<Element>());
  const found =
    options.scope === "stage"
      ? [...stage.querySelectorAll("[data-slot]")]
      : [...document.querySelectorAll("[data-slot]")].filter((element) => !seen.has(element));
  // Only a part that is visible now is measured, and only a measured part counts as seen, so a
  // mounted but hidden part, such as a closed `hiddenUntilFound` panel, is measured once it opens.
  const parts = found.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
  });
  for (const element of parts) {
    seen.add(element);
  }
  // Only a popup read's parts are waited on to leave; a stage's stay.
  globalThis.densityOpened = options.scope === "unseen" ? parts : [];

  const freeze = document.createElement("style");
  freeze.textContent = "*, *::before, *::after { transition: none !important; animation: none !important; }";
  document.head.append(freeze);
  const read = (element: Element): Record<string, string> => {
    const computed = element.computedStyleMap();
    return Object.fromEntries(
      options.properties.map((property) => [property, computed.get(property)?.toString() ?? ""])
    );
  };
  const base = parts.map(read);
  const parentType = parts.map((element) => {
    const parent = element.parentElement;
    if (parent === null) {
      return null;
    }
    // The typed computed value keeps a unitless line height unitless, as it inherits, and its
    // number at full precision, which its string rounds.
    const computed = parent.computedStyleMap();
    const exact = (property: string): string => {
      const value = computed.get(property);
      if (value instanceof CSSUnitValue) {
        return value.unit === "number"
          ? String(value.value)
          : `${String(value.value)}${value.unit === "percent" ? "%" : value.unit}`;
      }
      return value?.toString() ?? "";
    };
    return { parent, fontSize: exact("font-size"), lineHeight: exact("line-height") };
  });

  const scopes = [document.documentElement, ...document.querySelectorAll<HTMLElement>("[data-demo-stage]")];
  const restoreScopes = scopes.map((scope) => {
    const previous = Object.keys(options.sentinels).map(
      (name) => [name, scope.style.getPropertyValue(name), scope.style.getPropertyPriority(name)] as const
    );
    for (const [name, value] of Object.entries(options.sentinels)) {
      scope.style.setProperty(name, value, "important");
    }
    return () => {
      for (const [name, value, priority] of previous) {
        if (value === "") {
          scope.style.removeProperty(name);
        } else {
          scope.style.setProperty(name, value, priority);
        }
      }
    };
  });
  const sentinel = parts.map((element, index) => {
    const pin = parentType[index];
    if (pin === null || pin === undefined || !(pin.parent instanceof HTMLElement)) {
      return read(element);
    }
    const { style } = pin.parent;
    const previous = ["font-size", "line-height"].map(
      (name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)] as const
    );
    style.setProperty("font-size", pin.fontSize, "important");
    style.setProperty("line-height", pin.lineHeight, "important");
    const reading = read(element);
    for (const [name, value, priority] of previous) {
      if (value === "") {
        style.removeProperty(name);
      } else {
        style.setProperty(name, value, priority);
      }
    }
    return reading;
  });
  for (const restore of restoreScopes) {
    restore();
  }
  freeze.remove();

  return parts.map((element, index) => ({
    slot: element.getAttribute("data-slot") ?? "",
    overrides: options.overrides.filter(({ selector }) => element.matches(selector)).map(({ key }) => key),
    probe: { base: base[index] ?? {}, sentinel: sentinel[index] ?? {} },
  }));
}
