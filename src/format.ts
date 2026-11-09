export function bytes(value: number) {
  return value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(2)} GB`
    : `${(value / 1024 ** 2).toFixed(0)} MB`;
}

// Process CPU is recorded as a percentage of one core, not the whole host.
export function cores(percent: number) {
  return `${(percent / 100).toFixed(2)} cores`;
}
