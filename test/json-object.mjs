import { readFileSync } from "node:fs";

/**
 * @param {unknown} value
 */
function tag(value) {
  return Object.prototype.toString.call(value);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return tag(value) === "[object Object]";
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isString(value) {
  return tag(value) === "[object String]";
}

/**
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
export function readJsonObject(path) {
  // SAFETY: JSON.parse is untyped; the object guard below is the contract.
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(path, "utf8")));
  if (!isPlainObject(parsed)) {
    throw new Error(`${path} is not a JSON object`);
  }
  return parsed;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
export function asRecord(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
export function asString(value, label) {
  if (!isString(value)) {
    throw new Error(`${label} is not a string`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {Record<string, unknown>[]}
 */
export function asRecordArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is not an array`);
  }
  return value.map((entry, index) => asRecord(entry, `${label}[${String(index)}]`));
}

/**
 * Strip `//` and block comments from JSONC text without touching comment-like characters
 * inside strings. `.oxlintrc.json` is JSONC: oxlint reads comments there, `JSON.parse` cannot.
 *
 * @param {string} source
 * @returns {string}
 */
function stripJsonComments(source) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') {
      let end = index + 1;
      while (end < source.length && source[end] !== '"') {
        end += source[end] === "\\" ? 2 : 1;
      }
      output += source.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

/**
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
export function readJsoncObject(path) {
  // SAFETY: JSON.parse is untyped; the object guard below is the contract.
  const parsed = /** @type {unknown} */ (JSON.parse(stripJsonComments(readFileSync(path, "utf8"))));
  if (!isPlainObject(parsed)) {
    throw new Error(`${path} is not a JSON object`);
  }
  return parsed;
}
