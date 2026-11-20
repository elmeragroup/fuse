/**
 * A probe: the kit's registry cut down to a few sets, for a library UX can try before the whole kit
 * ships. It keeps the named sets and every set their definitions hold an instance of, at any depth,
 * so each kept instance still has its main component. `buildKit` builds the kept entries as it
 * builds the whole registry, with their pages, previews, docs, the icon library and the text styles,
 * so the probe has no assembly of its own.
 */

import { Effect, Result } from "effect";

import { manifestDefinition } from "../capture/manifest";
import { ProbeSetUnknown } from "./build-errors";
import { buildKit } from "./build-kit";
import type { BuiltKit } from "./build-kit";
import { instancePartsOf } from "./definition-parts";
import { KIT } from "./kit-registry";
import type { KitEntry } from "./kit-registry";

/**
 * The keys of the sets a probe keeps: the named ones, and every set their definitions instance,
 * at any depth.
 */
function instanceClosure(
  entries: ReadonlyMap<string, KitEntry>,
  named: ReadonlySet<string>
): ReadonlySet<string> {
  const kept = new Set<string>();
  const pending = [...named];
  for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
    const entry = entries.get(key);
    if (entry === undefined || kept.has(key)) {
      continue;
    }
    kept.add(key);
    pending.push(...instancePartsOf(manifestDefinition(entry.manifest)).map((part) => part.of.key));
  }
  return kept;
}

/**
 * The registry entries a probe builds: the named sets and every set they instance, in registry order.
 * A page whose example set the probe leaves out shows its first kept set instead.
 *
 * @param registry - The whole kit's registry.
 * @param named - The keys of the sets the probe shows.
 * @returns The entries, or `ProbeSetUnknown` for a key the registry does not hold.
 */
export function probeRegistry(
  registry: readonly KitEntry[],
  named: ReadonlySet<string>
): Result.Result<readonly KitEntry[], ProbeSetUnknown> {
  const entries = new Map(registry.map((entry) => [entry.manifest.key, entry]));
  const unknown = [...named].find((key) => !entries.has(key));
  if (unknown !== undefined) {
    return Result.fail(
      new ProbeSetUnknown({ message: `The kit builds no set ${unknown} to probe.`, set: unknown })
    );
  }
  const kept = instanceClosure(entries, named);
  const probed = registry.filter((entry) => kept.has(entry.manifest.key));
  return Result.succeed(
    probed.map((entry) => {
      if (kept.has(entry.page.example)) {
        return entry;
      }
      const first = probed.find((other) => other.page.slug === entry.page.slug) ?? entry;
      return { ...entry, page: { ...entry.page, example: first.manifest.key } };
    })
  );
}

/**
 * Build a probe: the entries {@link probeRegistry} keeps, built as `buildKit` builds the whole kit,
 * and marked as a probe, so Plan refuses a file that holds sets it lacks.
 *
 * @param named - The keys of the sets the probe shows.
 * @returns The probe and its coverage, or `ProbeSetUnknown` for a key the kit does not hold, or the
 *   failure `buildKit` stops with.
 */
export const buildProbe = Effect.fn("buildProbe")(function* (named: ReadonlySet<string>) {
  const registry = yield* Effect.fromResult(probeRegistry(KIT, named));
  const built = yield* buildKit(registry);
  const probe: BuiltKit = { ...built, spec: { ...built.spec, probe: true } };
  return probe;
});
