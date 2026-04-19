/* eslint-disable @typescript-eslint/no-explicit-any */
import { US_STATES } from "../constants/states";
import { normalizeStatusValue, parseNumericValue } from "../dsl/normalize";

export function fallbackDSL(userInput: string) {
  // 🔥 CRITICAL: normalize input (missing in your refactor)
  const text = userInput
    .toLowerCase()
    .replace(/\bproperties?\b/g, "") // ✅ FIX
    .trim();

  const filters: any[] = [];

  // ----------------------------------
  // 🧠 STATUS
  // ----------------------------------
  const statusKeywords = [
    "available",
    "occupied",
    "not available",
    "under maintenance",
  ];

  for (const s of statusKeywords) {
    if (text.includes(s)) {
      const normalized = normalizeStatusValue(s);
      if (normalized) {
        filters.push({
          field: "status",
          op: "=",
          value: normalized,
        });
      }
    }
  }

  // ----------------------------------
  // 💰 PRICE
  // ----------------------------------
  const priceMatch = text.match(/(\d+(\.\d+)?\s?(k|m|b)?)/);
  const priceContext = /\b(price|cost|value|under|below|above|budget)\b/;

  if (priceMatch && priceContext.test(text)) {
    filters.push({
      field: "price",
      op: "<=",
      value: parseNumericValue(priceMatch[0]),
    });
  }

  // ----------------------------------
  // 📍 GEO (NEW - DISTANCE SUPPORT)
  // ----------------------------------
  const distanceMatch = text.match(
    /(\d+(\.\d+)?)\s?(mile|miles|km|kilometer|kilometers|meter|meters|m)\s+(outside|within|from|of)\s+([a-z\s]+)/,
  );

  if (distanceMatch) {
    const distance = parseFloat(distanceMatch[1]);
    const unit = distanceMatch[3];
    const keyword = distanceMatch[4]; // ✅ THIS LINE FIXES YOUR ERROR
    const location = distanceMatch[5].trim();

    let radius_m = distance;

    // convert to meters
    // ----------------------------------
    // 📏 UNIT CONVERSION (EXTENDED)
    // ----------------------------------
    const unitNormalized = unit.toLowerCase();

    switch (true) {
      case unitNormalized.includes("mile"):
        radius_m = distance * 1609.34;
        break;

      case unitNormalized.includes("km"):
      case unitNormalized.includes("kilometer"):
        radius_m = distance * 1000;
        break;

      case unitNormalized.includes("meter"):
      case unitNormalized === "m":
        radius_m = distance;
        break;

      default:
        radius_m = distance; // fallback safe
    }
    const isOutside = keyword === "outside";

    return {
      geo: {
        location_text: location,
        radius_m: Math.round(radius_m),
        operator: isOutside ? "outside" : "within", // ✅ ADD THIS
      },
      filters,
      sort: null,
      limit: 20,
      offset: 0,
      __fallback: true,
    };
  }

  // ----------------------------------
  // 📊 CAP RATE
  // ----------------------------------
  const capRateMatch = text.match(/(\d+(\.\d+)?)\s?%/);
  if (capRateMatch && text.includes("cap")) {
    filters.push({
      field: "cap_rate",
      op: ">=",
      value: parseNumericValue(capRateMatch[0]),
    });
  }

  // ----------------------------------
  // 🌎 STATE
  // ----------------------------------
  for (const key in US_STATES) {
    if (text.includes(key)) {
      filters.push({
        field: "state",
        op: "=",
        value: US_STATES[key],
      });
    }
  }

  // ----------------------------------
  // 🏙️ CITY
  // ----------------------------------
  const cityMatch = text.match(/in\s+([a-z\s]+?)(?:\s|$)/);
  if (cityMatch) {
    const city = cityMatch[1].trim();
    if (city && city.length > 2) {
      filters.push({
        field: "city",
        op: "=",
        value: city,
      });
    }
  }

  // ----------------------------------
  // 🏢 TYPE (🔥 FIXED)
  // ----------------------------------
  const TYPES = [
    "office",
    "retail",
    "industrial",
    "apartment",
    "warehouse",
    "commercial",
    "mixed use", // 🔥 CRITICAL ADD
  ];

  const matchedTypes = TYPES.filter((t) => text.includes(t));

  if (matchedTypes.length === 1) {
    filters.push({
      field: "type",
      op: "like",
      value: `%${matchedTypes[0]}%`,
    });
  }

  if (matchedTypes.length > 1) {
    filters.push({
      field: "type",
      op: "in",
      value: matchedTypes,
    });
  }

  // ----------------------------------
  // 🏢 TENANCY TYPE (🔥 NEW)
  // ----------------------------------
  const tenancyNormalized = text
    .replace(/multi[\s-]?tenant/g, "multitenant")
    .replace(/single[\s-]?tenant/g, "singletenant");

  const TENANCY_TYPES = [
    { key: "multitenant", value: "MultiTenant" },
    { key: "singletenant", value: "SingleTenant" },
  ];

  const matchedTenancy = TENANCY_TYPES.filter((t) =>
    tenancyNormalized.includes(t.key),
  );

  // 👉 SINGLE tenancy
  if (matchedTenancy.length === 1) {
    filters.push({
      field: "tenancy_type", // ✅ IMPORTANT (do NOT use "type")
      op: "=",
      value: matchedTenancy[0].value,
    });
  }

  // 👉 MULTIPLE tenancy (rare but safe)
  if (matchedTenancy.length > 1) {
    filters.push({
      field: "tenancy_type",
      op: "in",
      value: matchedTenancy.map((t) => t.value),
    });
  }

  // ----------------------------------
  // 🔀 STATUS MERGE
  // ----------------------------------
  if (filters.filter((f) => f.field === "status").length > 1) {
    const statuses = filters
      .filter((f) => f.field === "status")
      .map((f) => f.value);

    const nonStatus = filters.filter((f) => f.field !== "status");

    nonStatus.push({
      field: "status",
      op: "in",
      value: statuses,
    });

    filters.length = 0;
    filters.push(...nonStatus);
  }

  return {
    geo: { location_text: null, radius_m: null },
    filters,
    sort: null,
    limit: 20,
    offset: 0,
    __fallback: true,
  };
}
