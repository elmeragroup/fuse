/**
 * Whether a push to `main` skips its canary. A push carries no labels, so the decision reads the
 * PRs the push merged. A native stack merge lands every layer as its own squash commit in one
 * push, so every pushed commit counts, not only the head: the push skips only when each of its
 * commits is the merge of a PR labelled `no-canary`.
 */

import { Context, Effect, Schema } from "effect";

/** A full commit SHA. */
export const CommitSha = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{40}$/u, { message: "a full commit SHA" })),
  Schema.brand("CommitSha")
);

/** A parsed commit SHA. */
export type CommitSha = typeof CommitSha.Type;

/** The part of a PR associated with a commit that the decision reads. */
export type AssociatedPull = {
  /** The PR number, for the diagnostics. */
  readonly number: number;
  /** The commit the PR merged as, or none while it is open. */
  readonly mergeCommitSha: string | null;
  /** The PR's head branch. */
  readonly headRef: string;
  /** The PR's label names. */
  readonly labels: ReadonlyArray<string>;
};

/** A commit's associated PRs could not be read. */
export class PullsUnavailable extends Schema.TaggedError<PullsUnavailable>()("PullsUnavailable", {
  message: Schema.String,
}) {}

/** The PRs associated with each commit: those that merged as it and those whose branch holds it. */
export class AssociatedPulls extends Context.Service<
  AssociatedPulls,
  {
    /** The PRs associated with `sha`. */
    readonly of: (sha: CommitSha) => Effect.Effect<ReadonlyArray<AssociatedPull>, PullsUnavailable>;
  }
>()("@elmeragroup/canary-opt-out/AssociatedPulls") {}

/** Whether the push skips its canary, and one line explaining each part of that. */
export type CanaryDecision = {
  /** Whether the push skips its canary. */
  readonly skip: boolean;
  /** One line per pushed commit, or one for a push decided without lookups. */
  readonly diagnostics: ReadonlyArray<string>;
};

/** The label that opts a PR's merge out of a canary. */
const NO_CANARY = "no-canary";

/**
 * The changesets bot's branch. Its merge lands the stable bump, which must publish, so it never
 * opts out whatever its labels say.
 */
const RELEASE_BRANCH = "changeset-release/main";

/**
 * GitHub lists at most this many commits in a push payload. A list this long may be cut short,
 * and an unlisted commit could be one that ships, so such a push publishes.
 */
const PUSH_COMMIT_CAP = 2048;

/** One pushed commit's part in the decision. */
type CommitVerdict = { readonly optedOut: boolean; readonly diagnostic: string };

/**
 * One commit's part in the decision. The associated PRs also list open PRs whose branch contains
 * the commit, so only a PR whose merge commit is this one counts. A commit no PR merged (a direct
 * push) publishes, and the release PR never opts out.
 */
function commitVerdict(sha: CommitSha, pulls: ReadonlyArray<AssociatedPull>): CommitVerdict {
  const merged = pulls.filter((pull) => pull.mergeCommitSha === sha);
  const release = merged.find((pull) => pull.headRef === RELEASE_BRANCH);
  if (release !== undefined) {
    return {
      optedOut: false,
      diagnostic: `${sha}: #${String(release.number)} is the release PR, which always publishes`,
    };
  }
  const unlabelled = merged.find((pull) => !pull.labels.includes(NO_CANARY));
  if (unlabelled !== undefined) {
    return {
      optedOut: false,
      diagnostic: `${sha}: #${String(unlabelled.number)} does not carry ${NO_CANARY}, so it publishes`,
    };
  }
  const [optedOut] = merged;
  if (optedOut === undefined) {
    return { optedOut: false, diagnostic: `${sha}: no PR merged as this commit, so it publishes` };
  }
  return { optedOut: true, diagnostic: `${sha}: #${String(optedOut.number)} carries ${NO_CANARY}` };
}

/**
 * Decides whether a push skips its canary: only when every pushed commit is the merge of a PR
 * labelled `no-canary`. A push that lists no commits, or may have been cut at GitHub's cap,
 * publishes without lookups.
 *
 * @param pushed - The pushed commits, in push order.
 * @returns The decision, or the first lookup that failed.
 */
export const decide = Effect.fn("CanaryDecision.decide")(function* (pushed: ReadonlyArray<CommitSha>) {
  if (pushed.length === 0) {
    return {
      skip: false,
      diagnostics: ["The push payload lists no commits, so it publishes."],
    } satisfies CanaryDecision;
  }
  if (pushed.length >= PUSH_COMMIT_CAP) {
    return {
      skip: false,
      diagnostics: ["The push payload lists commits up to GitHub's cap, so it publishes."],
    } satisfies CanaryDecision;
  }
  const pulls = yield* AssociatedPulls;
  const verdicts = yield* Effect.forEach(pushed, (sha) =>
    Effect.map(pulls.of(sha), (associated) => commitVerdict(sha, associated))
  );
  return {
    skip: verdicts.every((verdict) => verdict.optedOut),
    diagnostics: verdicts.map((verdict) => verdict.diagnostic),
  } satisfies CanaryDecision;
});
