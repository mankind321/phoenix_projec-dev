/* eslint-disable @typescript-eslint/no-explicit-any */
import { US_STATES } from "@/lib/constants/states";

export function normalizeStateValue(val: any): {
  abbr: string | null;
  full: string | null;
} {
  if (!val) return { abbr: null, full: null };

  // ✅ Handle array input (AI sometimes sends arrays)
  if (Array.isArray(val)) {
    const results = val
      .map(normalizeStateValue)
      .filter((r) => r.abbr || r.full);

    if (results.length === 0) return { abbr: null, full: null };

    return {
      abbr: results
        .map((r) => r.abbr)
        .filter(Boolean)
        .join(","),
      full: results
        .map((r) => r.full)
        .filter(Boolean)
        .join(","),
    };
  }

  // ✅ Reject non-string safely
  if (typeof val !== "string") {
    console.warn("⚠️ Invalid state value:", val);
    return { abbr: null, full: null };
  }

  const key = val.toLowerCase().trim().replace(/\s+/g, " ");

  // ✅ Case 1: full name → abbreviation
  if (US_STATES[key]) {
    return {
      abbr: US_STATES[key], // "florida" → "FL"
      full: key.replace(/\b\w/g, (c) => c.toUpperCase()), // "Florida"
    };
  }

  // ✅ Case 2: already abbreviation
  if (key.length === 2) {
    const abbr = key.toUpperCase();

    // reverse lookup (optional but ideal)
    const full =
      Object.keys(US_STATES).find((k) => US_STATES[k] === abbr) || null;

    return {
      abbr,
      full: full ? full.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    };
  }

  // ❌ Unknown input → do NOT uppercase blindly
  return { abbr: null, full: null };
}

export function parseNumericValue(val: any): number | any {
  if (typeof val === "number") {
    if (val > 0 && val < 1) return val * 100;
    return val;
  }

  if (typeof val === "string") {
    const v = val.toLowerCase().replace(/,/g, "").trim();

    if (v.includes("%")) {
      const num = parseFloat(v.replace("%", ""));
      return isNaN(num) ? val : num;
    }

    const match = v.match(/^(\d+(\.\d+)?)(k|m|b)?$/);
    if (match) {
      let num = parseFloat(match[1]);
      const suffix = match[3];

      if (suffix === "k") num *= 1_000;
      if (suffix === "m") num *= 1_000_000;
      if (suffix === "b") num *= 1_000_000_000;

      return num;
    }

    const asNumber = parseFloat(v);
    if (!isNaN(asNumber)) {
      if (asNumber > 0 && asNumber < 1) return asNumber * 100;
      return asNumber;
    }

    return val;
  }

  return val;
}

export function normalizePrompt(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // keep hyphen for tenancy
      .replace(/\bproperties?\b/g, "property")
      // 🔥 normalize tenancy variants early
      .replace(/multi[\s-]?tenant/g, "multitenant")
      .replace(/single[\s-]?tenant/g, "singletenant")
      .replace(/\bmultitenant\b/g, "multitenant")
      .replace(/\bsingletenant\b/g, "singletenant")
      .trim()
      .replace(/\s+/g, " ")
  );
}

export function normalizeStatusValue(val: string): string | null {
  if (!val) return null;

  const v = val.toLowerCase().trim();

  const STATUS_MAP: Record<string, string> = {
    available: "Available",
    active: "Available",
    vacant: "Available",
    open: "Available",
    "for lease": "Available",
    "for rent": "Available",

    occupied: "Occupied",
    leased: "Occupied",
    rented: "Occupied",

    "not available": "Not Available",
    unavailable: "Not Available",
    "off market": "Not Available",

    maintenance: "Under Maintenance",
    "under maintenance": "Under Maintenance",
  };

  if (STATUS_MAP[v]) return STATUS_MAP[v];

  for (const key in STATUS_MAP) {
    if (v.includes(key)) return STATUS_MAP[key];
  }

  return null;
}

// ----------------------------------
// 🏢 TENANCY TYPE NORMALIZATION (🔥 NEW)
// ----------------------------------
export function normalizeTenancyValue(val: any): string | null {
  if (!val) return null;

  if (typeof val !== "string") return null;

  const v = val.toLowerCase().trim().replace(/[\s-]/g, ""); // normalize multi-tenant → multitenant

  const TENANCY_MAP: Record<string, string> = {
    multitenant: "MultiTenant",
    singletenant: "SingleTenant",
  };

  if (TENANCY_MAP[v]) return TENANCY_MAP[v];

  // fallback fuzzy match (important for AI noise)
  if (v.includes("tenant") && v.includes("multi")) return "MultiTenant";
  if (v.includes("tenant") && v.includes("single")) return "SingleTenant";

  return null;
}
