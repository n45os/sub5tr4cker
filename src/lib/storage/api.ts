export function isStorageId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function toApiShape<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => toApiShape(item)) as T;
  }

  if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof Map)) {
    const record = value as Record<string, unknown>;
    const entries = Object.entries(record).map(([key, entryValue]) => [
      key === "id" ? "_id" : key,
      toApiShape(entryValue),
    ]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}
