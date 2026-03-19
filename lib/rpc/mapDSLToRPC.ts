import { US_STATES } from "../constants/states";
import {
  normalizeStateValue,
  normalizeStatusValue,
  parseNumericValue,
} from "../dsl/normalize";
import { geocodeLocation } from "../services/geocode";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function mapDSLToRPC(dsl: any) {
  const appendArray = (arr: any[] | null, vals: any[]) =>
    arr ? [...arr, ...vals] : vals;

  const dedupe = (arr: any[]) =>
    arr.filter((v, i) => v && arr.indexOf(v) === i);

  let lat = null;
  let lng = null;

  const params: any = {
    p_lat: null,
    p_lng: null,
    p_radius_m: null,
    p_outside_radius: false,
    p_max_radius_m: null,

    p_type: null,
    p_type_in: null,
    p_exclude_type_in: null,

    p_city: null,
    p_city_in: null,
    p_exclude_city_in: null,

    p_state: null,
    p_state_in: null,
    p_state_not_in: null,

    p_address: null,
    p_street_in: null,
    p_exclude_street_in: null,

    p_exclude_address: null,
    p_exclude_type: null,

    p_min_price: null,
    p_max_price: null,
    p_not_min_price: null,
    p_not_max_price: null,

    p_min_cap_rate: null,
    p_max_cap_rate: null,
    p_not_min_cap_rate: null,
    p_not_max_cap_rate: null,

    p_status: null,
    p_status_in: null,
    p_status_not_in: null,
  };

  // ----------------------------------
  // 🌍 GEO HANDLING (MERGED LOGIC)
  // ----------------------------------
  if (dsl.geo?.location_text) {
    const location = dsl.geo.location_text;

    // ✅ Always geocode (best accuracy)
    const geo = await geocodeLocation(location);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }

    // ✅ Admin search (no radius)
    if (!dsl.geo.radius_m) {
      const normalized = location.toLowerCase();
      const stateCode = US_STATES[normalized];

      if (stateCode) {
        if (!params.p_state && !params.p_state_in && !params.p_state_not_in) {
          params.p_state = stateCode;
        }
      } else {
        if (!params.p_city && !params.p_city_in) {
          params.p_city = normalized.trim();
        }
      }
    }
  }

  params.p_lat = lat;
  params.p_lng = lng;

  params.p_radius_m =
    typeof dsl.geo?.radius_m === "number" ? Math.round(dsl.geo.radius_m) : null;

  // ----------------------------------
  // 🌍 GEO OPERATOR + DONUT
  // ----------------------------------
  const geoOp = String(dsl.geo?.operator || "")
    .toLowerCase()
    .trim();
  params.p_outside_radius = geoOp === "outside";

  if (params.p_outside_radius && params.p_radius_m) {
    params.p_max_radius_m = params.p_radius_m + 50000;
  }

  if (params.p_outside_radius && dsl.geo?.location_text) {
    const city = dsl.geo.location_text.toLowerCase().trim();

    if (!params.p_city && !params.p_city_in) {
      params.p_exclude_city_in = appendArray(params.p_exclude_city_in, [city]);
    }
  }

  // ----------------------------------
  // 🔁 FILTER LOOP
  // ----------------------------------
  for (const f of dsl.filters || []) {
    const { field, op, value: rawValue } = f;

    if (rawValue == null || rawValue === "") continue;

    let value = rawValue;

    // normalize numeric
    if (field === "price" || field === "cap_rate") {
      value = Array.isArray(value)
        ? value.map(parseNumericValue)
        : parseNumericValue(value);
    }

    const SUPPORTED_OPS = [
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
    ];

    if (!SUPPORTED_OPS.includes(op)) continue;

    // ----------------------------------
    // 🟦 STATE (FULL FIX)
    // ----------------------------------
    if (field === "state") {
      const normalize = (v: string) => normalizeStateValue(v);

      if (op === "=") {
        const val = normalize(value);
        if (!val) continue;

        if (params.p_state && params.p_state !== val) {
          params.p_state_in = [params.p_state, val];
          params.p_state = null;
        } else if (params.p_state_in) {
          params.p_state_in.push(val);
        } else {
          params.p_state = val;
        }
      }

      if (op === "!=") {
        const val = normalize(value);
        if (!val) continue;

        params.p_state_not_in = dedupe([...(params.p_state_not_in || []), val]);
      }

      if (op === "in") {
        const vals = (Array.isArray(value) ? value : [value]).map(normalize);
        params.p_state = null;
        params.p_state_in = dedupe([...(params.p_state_in || []), ...vals]);
      }

      if (op === "not_in") {
        const vals = (Array.isArray(value) ? value : [value]).map(normalize);
        params.p_state_not_in = dedupe([
          ...(params.p_state_not_in || []),
          ...vals,
        ]);
      }
    }

    // ----------------------------------
    // 🟨 CITY (FIXED)
    // ----------------------------------
    if (field === "city") {
      const normalizeCity = (v: string) => v.toLowerCase().trim();

      if (op === "=") {
        const val = normalizeCity(value);

        if (params.p_city && params.p_city !== val) {
          params.p_city_in = [params.p_city, val];
          params.p_city = null;
        } else if (params.p_city_in) {
          params.p_city_in = dedupe([...(params.p_city_in || []), val]);
        } else {
          params.p_city = val;
        }
      }

      if (op === "!=") {
        const val = normalizeCity(value);
        params.p_exclude_city_in = dedupe([
          ...(params.p_exclude_city_in || []),
          val,
        ]);
      }

      if (op === "in") {
        const vals = (Array.isArray(value) ? value : [value]).map(
          normalizeCity,
        );
        params.p_city = null;
        params.p_city_in = dedupe([...(params.p_city_in || []), ...vals]);
      }

      if (op === "not_in") {
        const vals = (Array.isArray(value) ? value : [value]).map(
          normalizeCity,
        );
        params.p_exclude_city_in = dedupe([
          ...(params.p_exclude_city_in || []),
          ...vals,
        ]);
      }
    }

    // ----------------------------------
    // 🟧 TYPE (FIXED)
    // ----------------------------------
    if (field === "type") {
      const normalizeStr = (v: string) => v.toLowerCase().trim();

      if (op === "=") {
        const val = normalizeStr(value);

        if (params.p_type && params.p_type !== val) {
          params.p_type_in = [params.p_type, val];
          params.p_type = null;
        } else if (params.p_type_in) {
          params.p_type_in.push(val);
        } else {
          params.p_type = val;
        }
      }

      if (op === "!=") {
        const val = normalizeStr(value);
        params.p_exclude_type_in = dedupe([
          ...(params.p_exclude_type_in || []),
          val,
        ]);
      }

      if (op === "in") {
        const vals = (Array.isArray(value) ? value : [value]).map(normalizeStr);
        params.p_type = null;
        params.p_type_in = dedupe([...(params.p_type_in || []), ...vals]);
      }

      if (op === "not_in") {
        const vals = (Array.isArray(value) ? value : [value]).map(normalizeStr);
        params.p_exclude_type_in = dedupe([
          ...(params.p_exclude_type_in || []),
          ...vals,
        ]);
      }
    }

    // ----------------------------------
    // 🟩 STATUS (already correct)
    // ----------------------------------
    if (field === "status") {
      const normalize = (v: string) => normalizeStatusValue(v);

      if (op === "=") {
        const val = normalize(value);

        if (params.p_status && params.p_status !== val) {
          params.p_status_in = [params.p_status, val];
          params.p_status = null;
        } else if (params.p_status_in) {
          params.p_status_in.push(val);
        } else {
          params.p_status = val;
        }
      }

      if (op === "!=") {
        const val = normalize(value);
        params.p_status_not_in = dedupe([
          ...(params.p_status_not_in || []),
          val,
        ]);
      }

      if (op === "in") {
        params.p_status = null;
        params.p_status_in = dedupe(
          (Array.isArray(value) ? value : [value]).map(normalize),
        );
      }

      if (op === "not_in") {
        params.p_status_not_in = dedupe(
          (Array.isArray(value) ? value : [value]).map(normalize),
        );
      }
    }

    // ----------------------------------
    // 🟥 PRICE / CAP RATE (unchanged)
    // ----------------------------------
    if (field === "price") {
      if (op === ">" || op === ">=") params.p_min_price = value;
      if (op === "<" || op === "<=") params.p_max_price = value;

      if (op === "between") {
        params.p_min_price = value[0];
        params.p_max_price = value[1];
      }

      if (op === "not_between") {
        params.p_not_min_price = value[0];
        params.p_not_max_price = value[1];
      }
    }

    if (field === "cap_rate") {
      if (op === ">" || op === ">=") params.p_min_cap_rate = value;
      if (op === "<" || op === "<=") params.p_max_cap_rate = value;

      if (op === "between") {
        params.p_min_cap_rate = value[0];
        params.p_max_cap_rate = value[1];
      }
    }

    if (field === "address") {
      const clean = (v: string) =>
        String(v).replace(/[%_]/g, "").toLowerCase().trim();

      if (op === "=") {
        params.p_address = value;
        params.p_street_in = null;
        params.p_exclude_street_in = null;
      }

      if (op === "!=") {
        params.p_exclude_address = value;
      }

      if (op === "like") {
        params.p_street_in = appendArray(params.p_street_in, [clean(value)]);
      }

      if (op === "not_like") {
        params.p_exclude_street_in = appendArray(params.p_exclude_street_in, [
          clean(value),
        ]);
      }

      if (op === "in") {
        const vals = (Array.isArray(value) ? value : [value]).map(clean);
        params.p_street_in = appendArray(params.p_street_in, vals);
      }

      if (op === "not_in") {
        const vals = (Array.isArray(value) ? value : [value]).map(clean);
        params.p_exclude_street_in = appendArray(
          params.p_exclude_street_in,
          vals,
        );
      }
    }
  }
  return params;
}
