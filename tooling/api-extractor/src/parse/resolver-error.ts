/** A resolver/policy failure keeps the symbol breadcrumb without importing a compiler type. */
export class ResolverFailure extends Error {
  readonly symbolStack: readonly string[];
  readonly cause: unknown;

  constructor(message: string, symbolStack: readonly string[], cause: unknown) {
    super(message);
    this.name = "ResolverFailure";
    this.symbolStack = symbolStack;
    this.cause = cause;
  }
}
