export function localize(key) {
  return key;
}

export function format(key, data) {
  let result = key;
  for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
  return result;
}
