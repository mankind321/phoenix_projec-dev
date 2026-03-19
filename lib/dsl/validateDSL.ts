/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  parseNumericValue,
  normalizeStateValue,
  normalizeStatusValue,
} from "./normalize";

export function validateAndSanitizeDSL(dsl: any) {
  if (!dsl || typeof dsl !== "object") return null;

  const ALLOWED_FIELDS = new Set([
    "type",
    "price",
    "cap_rate",
    "state",
    "city",
    "address",
    "status",
  ]);

  const ALLOWED_OPS = new Set([
    "=",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "in",
    "not_in",
    "between",
    "not_between",
    "like",
    "not_like",
  ]);

  const safeFilters: any[] = [];

  for (const f of dsl.filters || []) {
    if (!f?.field || !f?.op) continue;
    if (!ALLOWED_FIELDS.has(f.field)) continue;
    if (!ALLOWED_OPS.has(f.op)) continue;

    let value = f.value;

    if (f.field === "price" || f.field === "cap_rate") {
      value = Array.isArray(value)
        ? value.map(parseNumericValue)
        : parseNumericValue(value);

      if (value == null || value === "") continue;
    }

    if (f.field === "state") {
      if (Array.isArray(value)) {
        value = value.map(normalizeStateValue).filter(Boolean);
      } else {
        value = normalizeStateValue(value);
      }
    }
    if (f.field === "status") value = normalizeStatusValue(value);
    if (!value) continue;

    safeFilters.push({ field: f.field, op: f.op, value });
  }

  return {
    geo: dsl.geo || { location_text: null, radius_m: null },
    filters: safeFilters,
    sort: dsl.sort || null,
    limit: dsl.limit ?? 20,
    offset: dsl.offset ?? 0,
  };
}
