// JSON values shared by the validators. A missing member is distinct from a present null.
export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function get(value, key, fallback = null) {
  return value != null && Object.hasOwn(value, key) ? value[key] : fallback
}

export function sizeOf(value) {
  if (value instanceof Set) return value.size
  if (isRecord(value)) return Object.keys(value).length
  if (typeof value === 'string') return Array.from(value).length
  if (Array.isArray(value)) return value.length
  throw new TypeError('expected an object, array or string')
}

export function hasValue(value) {
  if (Array.isArray(value) || isRecord(value) && !(value instanceof Set)) return sizeOf(value) !== 0
  if (value instanceof Set) return value.size !== 0
  return Boolean(value)
}

export function iterable(value) {
  if (isRecord(value) && !(value instanceof Set)) return Object.keys(value)
  return value
}

export function toSet(value) {
  return new Set(iterable(value))
}

export function contains(container, value) {
  if (container instanceof Set) return container.has(value)
  if (typeof container === 'string' || Array.isArray(container)) return container.includes(value)
  return typeof value === 'string' && container != null && Object.hasOwn(container, value)
}

export function sameMembers(left, right) {
  return left.size === right.size && !hasOtherMembers(left, right)
}

export function hasOtherMembers(left, right) {
  for (const value of left) {
    if (!right.has(value)) return true
  }
  return false
}

export function enumerate(values) {
  return values.entries()
}

export function splitOnce(value, separator) {
  const index = value.indexOf(separator)
  return index < 0 ? [value] : [value.slice(0, index), value.slice(index + separator.length)]
}
