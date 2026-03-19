/* eslint-disable @typescript-eslint/no-explicit-any */
import { US_STATES } from "@/lib/constants/states";

export function normalizeStateValue(val: string) {
  const key = val.toLowerCase().trim();
  return US_STATES[key] || US_STATES[val.toLowerCase()] || val.toUpperCase();
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
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\bproperties?\b/g, "property")
    .trim()
    .replace(/\s+/g, " ");
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