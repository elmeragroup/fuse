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
