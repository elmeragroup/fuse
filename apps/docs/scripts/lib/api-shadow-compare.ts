/*
 * The comparator deliberately accepts the closed JSON-shaped values produced by
 * the two extractor models. Runtime checks here are the boundary that turns those
 * model values into a canonical fingerprint; the anti-slop generic-input rules
 * would reject that required recursive comparison otherwise.
 */
/* oxlint-disable anti-slop/no-unknown-parameters -- canonical comparison owns the closed model-value boundary. */
/* oxlint-disable anti-slop/no-unsafe-dictionary-type -- recursive model values are checked before dictionary traversal. */
/* oxlint-disable anti-slop/no-runtime-typeof -- recursive canonicalization must distinguish primitive model values. */
/* oxlint-disable anti-slop/no-known-value-widening -- named-record views are the comparator's canonical boundary. */

import type { ApiPart } from "../../src/lib/docs-model.ts";
import type {
  ApiShadowDifference,
  DocsShadowComponentResult,
  DocsShadowSnapshot,
  ProblemShadowDifference,
  ReviewedApiShadowDifference,
  ReviewedProblemShadowDifference,
  ShadowPartEvidence,
  ShadowProblem,
} from "./api-shadow-types.ts";

type ProblemDifferenceDraft = {
  component: string;
  key: string;
  current?: ShadowProblem;
  effect?: ShadowProblem;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Canonical JSON retains undefined, object-key order, and array order for fingerprints. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return '"<undefined>"';
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  // The extractor model contains only JSON-shaped values at this point; the
  // fallback branch above handles every non-serializable representation.
  return JSON.stringify(value);
}

function compareJson(
  current: unknown,
  effect: unknown,
  prefix: string,
  component: string,
  differences: ApiShadowDifference[]
): void {
  if (Object.is(current, effect)) return;
  if (Array.isArray(current) || Array.isArray(effect)) {
    // Keep an array length/type drift at element paths as well. In particular,
    // an omitted array-valued field must not become an opaque approval for the
    // whole collection (for example `forwardedFrom` or `declarationPaths`).
    if (Array.isArray(current) && Array.isArray(effect)) {
      const length = Math.max(current.length, effect.length);
      for (let index = 0; index < length; index += 1) {
        compareJson(current[index], effect[index], `${prefix}[${String(index)}]`, component, differences);
      }
      return;
    }
    if (Array.isArray(current)) {
      if (current.length === 0) {
        differences.push({ component, path: `${prefix}[0]`, current, effect });
      } else {
        compareJson(current[0], effect, `${prefix}[0]`, component, differences);
        for (let index = 1; index < current.length; index += 1) {
          compareJson(current[index], undefined, `${prefix}[${String(index)}]`, component, differences);
        }
      }
      return;
    }
    if (!Array.isArray(effect)) {
      // This is only reachable for a non-array runtime value paired with a
      // value that entered the branch through a future model extension. Keep
      // the path element-scoped even in that defensive case.
      differences.push({ component, path: `${prefix}[0]`, current, effect });
      return;
    }
    if (effect.length === 0) {
      differences.push({ component, path: `${prefix}[0]`, current, effect });
    } else {
      compareJson(current, effect[0], `${prefix}[0]`, component, differences);
      for (let index = 1; index < effect.length; index += 1) {
        compareJson(undefined, effect[index], `${prefix}[${String(index)}]`, component, differences);
      }
    }
    return;
  }
  if (isRecord(current) && isRecord(effect)) {
    const keys = [...new Set([...Object.keys(current), ...Object.keys(effect)])].sort((left, right) =>
      left.localeCompare(right)
    );
    for (const key of keys) {
      const currentValue = current[key];
      const effectValue = effect[key];
      if (currentValue === undefined && isRecord(effectValue)) {
        differences.push({ component, path: `${prefix}.${key}`, current: currentValue, effect: effectValue });
      } else if (effectValue === undefined && isRecord(currentValue)) {
        differences.push({ component, path: `${prefix}.${key}`, current: currentValue, effect: effectValue });
      } else {
        compareJson(currentValue, effectValue, `${prefix}.${key}`, component, differences);
      }
    }
    return;
  }
  if (isRecord(current)) {
    const keys = Object.keys(current);
    if (keys.length === 0) {
      differences.push({ component, path: prefix, current, effect });
      return;
    }
    for (const key of keys.sort((left, right) => left.localeCompare(right))) {
      compareJson(current[key], undefined, `${prefix}.${key}`, component, differences);
    }
    return;
  }
  if (isRecord(effect)) {
    const keys = Object.keys(effect);
    if (keys.length === 0) {
      differences.push({ component, path: prefix, current, effect });
      return;
    }
    for (const key of keys.sort((left, right) => left.localeCompare(right))) {
      compareJson(undefined, effect[key], `${prefix}.${key}`, component, differences);
    }
    return;
  }
  differences.push({ component, path: prefix, current, effect });
}

function namedRecords<T extends { name: string }, U>(
  values: readonly T[],
  project: (value: T) => U,
  label = "named item"
): Record<string, U> {
  // SAFETY: a null-prototype dictionary is used only for string-keyed names;
  // every duplicate is rejected before the value is assigned.
  const records = Object.create(null) as Record<string, U>;
  for (const value of values) {
    if (Object.prototype.hasOwnProperty.call(records, value.name)) {
      throw new Error(`duplicate ${label} name "${value.name}"`);
    }
    records[value.name] = project(value);
  }
  return records;
}

/**
 * Reports relative-order changes for names present on both sides. Missing
 * names are handled by the name-keyed semantic comparison; they do not turn
 * every remaining member into a spurious order change.
 */
function compareNamedOrder<T extends { name: string }>(
  component: string,
  current: readonly T[],
  effect: readonly T[],
  prefix: string,
  label: string,
  differences: ApiShadowDifference[]
): void {
  const currentNames = current.map((value) => value.name);
  const effectNames = effect.map((value) => value.name);
  const currentSet = new Set(currentNames);
  const effectSet = new Set(effectNames);

  if (currentSet.size !== currentNames.length) {
    throw new Error(`duplicate ${label} name in current values`);
  }
  if (effectSet.size !== effectNames.length) {
    throw new Error(`duplicate ${label} name in Effect values`);
  }

  const currentIndex = new Map(currentNames.map((name, index) => [name, index] as const));
  const effectIndex = new Map(effectNames.map((name, index) => [name, index] as const));
  const currentCommonOrder = new Map<string, number>();
  const effectCommonOrder = new Map<string, number>();

  let currentOrder = 0;
  for (const name of currentNames) {
    if (effectSet.has(name)) {
      currentCommonOrder.set(name, currentOrder);
      currentOrder += 1;
    }
  }
  let effectOrder = 0;
  for (const name of effectNames) {
    if (currentSet.has(name)) {
      effectCommonOrder.set(name, effectOrder);
      effectOrder += 1;
    }
  }

  const commonNames = [...currentCommonOrder.keys()].sort((left, right) => left.localeCompare(right));
  for (const name of commonNames) {
    if (currentCommonOrder.get(name) === effectCommonOrder.get(name)) continue;
    differences.push({
      component,
      path: `${prefix}.${name}.order`,
      current: currentIndex.get(name),
      effect: effectIndex.get(name),
    });
  }
}

function visiblePart(part: ApiPart) {
  return {
    name: part.name,
    rsc: part.rsc,
    sourcePath: part.sourcePath,
    props: namedRecords(
      part.props,
      (prop) => ({
        name: prop.name,
        origin: prop.origin,
        type: prop.type,
        defaultValue: prop.defaultValue,
        description: prop.description,
        required: prop.required,
      }),
      "prop"
    ),
    forwardedFrom: part.forwardedFrom,
    forwardedCount: part.forwardedCount,
  };
}

export function compareParts(
  component: string,
  current: readonly ApiPart[],
  effect: readonly ApiPart[]
): readonly ApiShadowDifference[] {
  const differences: ApiShadowDifference[] = [];
  const currentNamed = namedRecords(current, visiblePart, "part");
  const effectNamed = namedRecords(effect, visiblePart, "part");
  const currentByName = new Map(current.map((part) => [part.name, part] as const));
  const effectByName = new Map(effect.map((part) => [part.name, part] as const));
  compareJson(currentNamed, effectNamed, "parts", component, differences);
  compareNamedOrder(component, current, effect, "parts", "part", differences);
  for (const name of [...currentByName.keys()].sort((left, right) => left.localeCompare(right))) {
    const currentPart = currentByName.get(name);
    const effectPart = effectByName.get(name);
    if (currentPart === undefined || effectPart === undefined) continue;
    compareNamedOrder(
      component,
      currentPart.props,
      effectPart.props,
      `parts.${name}.props`,
      "prop",
      differences
    );
  }
  return differences;
}

export function compareEvidence(
  component: string,
  current: readonly ShadowPartEvidence[],
  effect: readonly ShadowPartEvidence[]
): readonly ApiShadowDifference[] {
  const differences: ApiShadowDifference[] = [];
  const currentNamed = namedRecords(
    current,
    (part) => ({
      ...part,
      props: namedRecords(part.props, (prop) => prop, "evidence prop"),
    }),
    "evidence part"
  );
  const effectNamed = namedRecords(
    effect,
    (part) => ({
      ...part,
      props: namedRecords(part.props, (prop) => prop, "evidence prop"),
    }),
    "evidence part"
  );
  const currentByName = new Map(current.map((part) => [part.name, part] as const));
  const effectByName = new Map(effect.map((part) => [part.name, part] as const));
  compareJson(currentNamed, effectNamed, "evidence", component, differences);
  compareNamedOrder(component, current, effect, "evidence", "evidence part", differences);
  for (const name of [...currentByName.keys()].sort((left, right) => left.localeCompare(right))) {
    const currentPart = currentByName.get(name);
    const effectPart = effectByName.get(name);
    if (currentPart === undefined || effectPart === undefined) continue;
    compareNamedOrder(
      component,
      currentPart.props,
      effectPart.props,
      `evidence.${name}.props`,
      "evidence prop",
      differences
    );
  }
  return differences;
}

export function compareComponent(entry: DocsShadowComponentResult): readonly ApiShadowDifference[] {
  return [
    ...compareParts(entry.inventory.slug, entry.current, entry.effect),
    ...compareEvidence(entry.inventory.slug, entry.currentEvidence, entry.effectEvidence),
  ];
}

function problemKey(problem: ShadowProblem): string {
  return `${problem.source}|${problem.component}|${problem.code}|${problem.message}`;
}

/** Compares the complete problem-log multiset, including source and exact location text. */
export function compareProblems(
  current: readonly ShadowProblem[],
  effect: readonly ShadowProblem[]
): readonly ProblemShadowDifference[] {
  const group = (problems: readonly ShadowProblem[]) => {
    const grouped = new Map<string, ShadowProblem[]>();
    for (const problem of problems) {
      const entries = grouped.get(problemKey(problem)) ?? [];
      entries.push(problem);
      grouped.set(problemKey(problem), entries);
    }
    return grouped;
  };
  const currentByKey = group(current);
  const effectByKey = group(effect);
  const keys = [...new Set([...currentByKey.keys(), ...effectByKey.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );
  const differences: ProblemShadowDifference[] = [];
  for (const key of keys) {
    const oldProblems = currentByKey.get(key) ?? [];
    const newProblems = effectByKey.get(key) ?? [];
    const missing = Math.max(oldProblems.length, newProblems.length);
    for (let index = 0; index < missing; index += 1) {
      const oldProblem = oldProblems[index];
      const newProblem = newProblems[index];
      if (oldProblem !== undefined && newProblem !== undefined) continue;
      const difference: ProblemDifferenceDraft = {
        component: oldProblem?.component ?? newProblem?.component ?? "unknown",
        key: `${key}#${String(index + 1)}`,
      };
      if (oldProblem !== undefined) difference.current = oldProblem;
      if (newProblem !== undefined) difference.effect = newProblem;
      differences.push(difference);
    }
  }
  return differences;
}

function differenceKey(kind: "api" | "problem", component: string, path: string): string {
  return `${kind}|${component}|${path}`;
}

function hasReviewedReason(reason: string | undefined): boolean {
  return typeof reason === "string" && reason.trim() !== "";
}

/**
 * Fails when a snapshot entry has no one-line reason, naming the first such
 * entry so a reviewer can fill it without scanning the whole file.
 */
export function assertReviewedReasons(snapshot: DocsShadowSnapshot): void {
  for (const difference of snapshot.apiDifferences) {
    if (hasReviewedReason(difference.reason)) continue;
    throw new Error(
      `snapshot entry missing reason: ${differenceKey("api", difference.component, difference.path)}`
    );
  }
  for (const difference of snapshot.problemDifferences) {
    if (hasReviewedReason(difference.reason)) continue;
    throw new Error(
      `snapshot entry missing reason: ${differenceKey("problem", difference.component, difference.key)}`
    );
  }
}

function apiFingerprint(difference: ApiShadowDifference | ReviewedApiShadowDifference): string {
  return canonicalJson(
    JSON.parse(
      JSON.stringify({
        component: difference.component,
        path: difference.path,
        current: difference.current,
        effect: difference.effect,
      })
    )
  );
}

function problemFingerprint(difference: ProblemShadowDifference | ReviewedProblemShadowDifference): string {
  return canonicalJson(
    JSON.parse(
      JSON.stringify({
        component: difference.component,
        key: difference.key,
        current: difference.current,
        effect: difference.effect,
      })
    )
  );
}

export type SnapshotReview = {
  /** Measured now, absent from (or different in) the snapshot. */
  readonly unexplained: readonly string[];
  /** In the snapshot, no longer measured (or measured with another value). */
  readonly stale: readonly string[];
};

/**
 * Compares the measured differences with the reviewed snapshot by exact key and
 * canonical value. Both directions are reported so an improvement that removes a
 * difference is as visible as a regression that adds one.
 */
export function reviewAgainstSnapshot(
  apiDifferences: readonly ApiShadowDifference[],
  problemDifferences: readonly ProblemShadowDifference[],
  snapshot: {
    readonly apiDifferences: readonly ApiShadowDifference[];
    readonly problemDifferences: readonly ProblemShadowDifference[];
  }
): SnapshotReview {
  // Reasons live only on the snapshot; fingerprints ignore them so a review
  // note cannot manufacture a measured-vs-reviewed mismatch.
  const measured = new Map<string, string>();
  for (const difference of apiDifferences) {
    const key = differenceKey("api", difference.component, difference.path);
    if (measured.has(key)) throw new Error(`duplicate measured API difference ${key}`);
    measured.set(key, apiFingerprint(difference));
  }
  for (const difference of problemDifferences) {
    const key = differenceKey("problem", difference.component, difference.key);
    if (measured.has(key)) throw new Error(`duplicate measured problem difference ${key}`);
    measured.set(key, problemFingerprint(difference));
  }
  const reviewed = new Map<string, string>();
  for (const difference of snapshot.apiDifferences) {
    reviewed.set(differenceKey("api", difference.component, difference.path), apiFingerprint(difference));
  }
  for (const difference of snapshot.problemDifferences) {
    reviewed.set(
      differenceKey("problem", difference.component, difference.key),
      problemFingerprint(difference)
    );
  }
  const unexplained = [...measured].filter(([key, value]) => reviewed.get(key) !== value).map(([key]) => key);
  const stale = [...reviewed].filter(([key, value]) => measured.get(key) !== value).map(([key]) => key);
  return {
    unexplained: unexplained.sort((left, right) => left.localeCompare(right)),
    stale: stale.sort((left, right) => left.localeCompare(right)),
  };
}
