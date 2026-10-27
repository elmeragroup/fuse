/**
 * The guard every object the fake exposes sits behind. Reading or writing a member the fake does
 * not model throws, so a plugin change that reads or writes something new fails in a test instead
 * of passing on an `undefined`.
 */

/** Members test runners and promises probe on any object, which the guard answers with nothing. */
const INTROSPECTION = new Set<string>([
  "then",
  "toJSON",
  "asymmetricMatch",
  "$$typeof",
  "nodeType",
  "tagName",
  "@@__IMMUTABLE_ITERABLE__@@",
  "@@__IMMUTABLE_RECORD__@@",
  "_isMockFunction",
]);

function isIntrospection(property: string | symbol): boolean {
  return INTROSPECTION.has(String(property)) || String(property).startsWith("Symbol(");
}

/**
 * Wrap an object so that reading or writing a member it does not define throws.
 *
 * @param target - The object that models the API.
 * @param kind - What the object stands for, for the error.
 * @returns The guarded object.
 */
export function guard<Target extends object>(target: Target, kind: string): Target {
  return new Proxy(target, {
    get: (object, property) => {
      if (property in object) {
        // SAFETY: the `in` check found the member on the object or its prototype chain.
        return object[property as keyof Target];
      }
      if (isIntrospection(property)) {
        return undefined;
      }
      throw new Error(`The fake Figma file does not model ${kind}.${String(property)}.`);
    },
    set: (object, property, value) => {
      if (!(property in object)) {
        throw new Error(`The fake Figma file does not model writing ${kind}.${String(property)}.`);
      }
      if (!Reflect.set(object, property, value)) {
        throw new Error(`${kind}.${String(property)} is read-only.`);
      }
      return true;
    },
  });
}
