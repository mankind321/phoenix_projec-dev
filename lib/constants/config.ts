export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const ALLOWED_SORT_FIELDS = new Set([
  "property_created_at",
  "property_updated_at",
  "price",
  "cap_rate",
  "name",
]);

export const MODEL = "models/gemini-2.5-flash";