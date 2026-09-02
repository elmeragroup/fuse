import { Data } from "effect";

/** A resolver/policy failure keeps the symbol breadcrumb without importing a compiler type. */
export class ResolverFailure extends Data.TaggedError("ResolverFailure")<{
  readonly message: string;
  readonly symbolStack: readonly string[];
  readonly cause: unknown;
}> {}
