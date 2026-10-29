import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { DENSITIES } from "@elmeragroup/fuse/theme";
import { PART_DENSITY, resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";
import type { DensityPart } from "@elmeragroup/fuse/theme-catalog";

import { currentColorReport, probeBorders } from "./border-attribution";
import type { BorderReading } from "./border-attribution";
import { launchSuiteBrowser } from "./demo-page";
import { SWEEP_GROUPS, sweepDemos, sweepGroup } from "./demo-sweep";
import type { DemoProbe, Located } from "./demo-sweep";
import { PROBED_PROPERTIES, probeParts, roleViolation, sentinelLengths } from "./density-attribution";
import type { PartReading, ProbeOptions } from "./density-attribution";

/**
 * The demo coverage gates. One sweep walks component pages' demos at both densities, opening
 * every popup, disclosure and tooltip, and runs both suites' probes on each reveal. The pages split
 * into `SWEEP_GROUPS` groups, one suite file each, `demo-coverage-<group>.browser.test.ts`, so the
 * files together sweep every component page; `demo-coverage.test.ts` holds them to that.
 *
 * The density coverage gate. Every component page's demos are probed once per density, with the
 * document and every stage stamped, and every visible part must
 * behave as `PART_DENSITY` declares: a `control`, `row`, `surface` or `label` part reads a density
 * metric through its own properties, and a `layout` or `fixed` part reads none. Attribution is
 * `density-attribution.ts`'s; the oracle is the declared table, the unit under test the rendered
 * parts. Where one slot renders with two roles, an override key (the slot plus a CSS selector
 * suffix) splits them, such as a menu row in the collapsed icon rail, which is `fixed` there.
 */

/** One probed part on one page. */
type Instance = Located<PartReading>;

function isDensityPart(key: string): key is DensityPart {
  return Object.hasOwn(PART_DENSITY, key);
}

/** Every override key with the selector it matches a part with: `[data-slot="slot"]` plus its suffix. */
const OVERRIDES = Object.keys(PART_DENSITY).flatMap((key) => {
  const match = /^(?<slot>[a-z0-9-]+)(?<suffix>[[:].*)$/u.exec(key);
  const slot = match?.groups?.slot;
  const suffix = match?.groups?.suffix;
  return slot === undefined || suffix === undefined
    ? []
    : [{ key, selector: `[data-slot="${slot}"]${suffix}` }];
});

/** The part an instance resolves to: the first override in table order it matches, else its slot. */
function partOf({ slot, overrides }: Instance): DensityPart | undefined {
  const key = overrides[0] ?? slot;
  return isDensityPart(key) ? key : undefined;
}

const SENTINELS = sentinelLengths(resolveThemeCatalog().density);

const densityProbe: DemoProbe<PartReading> = (page, scope) => {
  const options: ProbeOptions = {
    scope,
    sentinels: SENTINELS,
    properties: PROBED_PROPERTIES,
    overrides: OVERRIDES,
  };
  return page.evaluate(probeParts, options);
};

function pagesOf(instances: readonly Instance[]): string {
  return [...new Set(instances.map(({ page }) => page))].join(", ");
}

/** The suite file name that sweeps a group, `demo-coverage-<group>.browser.test.ts`. */
export const GROUP_FILE = /(?:^|\/)demo-coverage-(?<group>\d+)\.browser\.test\.ts$/u;

/**
 * Registers the coverage gates for the sweep group a suite file's name gives.
 *
 * @param fileUrl - The suite file's `import.meta.url`, named for its group.
 */
export function describeDemoCoverage(fileUrl: string): void {
  const group = Number(GROUP_FILE.exec(fileURLToPath(fileUrl))?.groups?.group);
  const slugs = sweepGroup(group);
  const browser = launchSuiteBrowser();
  const measured: Instance[] = [];
  const bordered: Located<BorderReading>[] = [];

  beforeAll(async () => {
    const readings = await sweepDemos(browser(), slugs, densityProbe, (page, scope) =>
      page.evaluate(probeBorders, scope)
    );
    measured.push(...readings.discovered);
    bordered.push(...readings.probed);
  }, 900_000);

  describe(`demo coverage, group ${String(group)} of ${String(SWEEP_GROUPS)}`, () => {
    describeDensityCoverage(measured);
    describeBorderCoverage(bordered);
  });
}

function describeDensityCoverage(measured: readonly Instance[]): void {
  describe("density coverage", () => {
    // The later densities re-read the parts the first one found, so a page whose parts one density
    // misses lost a reveal or a restamp, and its role checks pass on nothing. A virtualized list
    // mounts fewer of its taller rows, so the check compares which parts each density read.
    it("reads every swept page's parts at every density", () => {
      const slots = new Map<string, Set<string>[]>();
      for (const { page, density, slot } of measured) {
        const perDensity = slots.get(page) ?? DENSITIES.map(() => new Set<string>());
        perDensity[DENSITIES.indexOf(density)]?.add(slot);
        slots.set(page, perDensity);
      }
      const uneven = [...slots].flatMap(([page, perDensity]) => {
        const all = new Set(perDensity.flatMap((read) => [...read]));
        return DENSITIES.flatMap((density, index) => {
          const missed = [...all].filter((slot) => perDensity[index]?.has(slot) !== true);
          return missed.length === 0 ? [] : [`${page} at ${density} misses ${missed.sort().join(", ")}`];
        });
      });
      expect(slots.size).toBeGreaterThan(0);
      expect(uneven).toEqual([]);
    });

    it("finds a declared role for every rendered part", () => {
      const undeclared = new Set(
        measured.filter((instance) => partOf(instance) === undefined).map(({ slot }) => slot)
      );
      expect([...undeclared].sort()).toEqual([]);
    });

    it("renders every instance of every part as its declared role", () => {
      const broken = new Map<string, Instance[]>();
      for (const instance of measured) {
        const part = partOf(instance);
        if (part === undefined) {
          continue;
        }
        const role = PART_DENSITY[part];
        const reason = roleViolation(role, instance.probe);
        if (reason !== undefined) {
          const claim = `${part} is ${role} but ${reason} at ${instance.density}`;
          broken.set(claim, [...(broken.get(claim) ?? []), instance]);
        }
      }
      const report = [...broken].map(
        ([claim, instances]) => `${claim} (${String(instances.length)} on ${pagesOf(instances)})`
      );
      expect(report.sort()).toEqual([]);
    });
  });
}

function describeBorderCoverage(bordered: readonly Located<BorderReading>[]): void {
  describe("border colour coverage", () => {
    /**
     * The unit under test is every rendered demo element and its `::before` and `::after`; the
     * oracle is a sentinel `color` set on every box: a drawn border whose colour follows it is
     * `currentColor`, the text colour, which no Fuse part draws a border in.
     */
    it("draws no border in currentColor", () => {
      expect(currentColorReport(bordered)).toEqual([]);
    });
  });
}
