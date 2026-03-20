import { US_STATES } from "../constants/states";
import {
  normalizeStatusValue,
  parseNumericValue,
} from "../dsl/normalize";
import { resolveState } from "../dsl/validateDSL";
import { geocodeLocation } from "../services/geocode";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function mapDSLToRPC(dsl: any) {
  const appendArray = (arr: any[] | null, vals: any[]) =>
    arr ? [...arr, ...vals] : vals;

  let lat = null;
  let lng = null;

  const params: any = {
    p_lat: null,
    p_lng: null,
    p_radius_m: null,
    p_outside_radius: false, // ✅ ALWAYS DEFAULT
    p_max_radius_m: null,

    p_type: null,
    p_type_in: null, // ✅ ADD THIS
    p_exclude_type_in: null,
    p_city: null,
    p_state: null,

    p_state_in: null,
    p_state_not_in: null,

    p_exclude_city: null,
    p_exclude_address: null,
    p_exclude_type: null,

    p_min_price: null,
    p_max_price: null,

    // ✅ ADD THESE (FOR OR LOGIC)
    p_not_min_price: null,
    p_not_max_price: null,

    p_min_cap_rate: null,
    p_max_cap_rate: null,

    // (optional future)
    p_not_min_cap_rate: null,
    p_not_max_cap_rate: null,

    p_address: null,
    p_exclude_city_in: null,

    p_status: null,
    p_status_in: null,
    p_status_not_in: null,

    p_city_in: null, // ✅ ADD
    p_street_in: null, // ✅ ADD
    p_exclude_street_in: null, // ✅ ADD
  };

  if (dsl.geo?.location_text) {
    const location = dsl.geo.location_text;

    // ✅ ALWAYS geocode if location exists
    const geo = await geocodeLocation(location);

    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }

    // ----------------------------------
    // ADMIN SEARCH (NO RADIUS)
    // ----------------------------------
    if (!dsl.geo.radius_m) {
      const normalized = location.toLowerCase();
      const stateCode = US_STATES[normalized];

      if (stateCode) {
        if (!params.p_state && !params.p_state_in && !params.p_state_not_in) {
          params.p_state = stateCode;
        }
      } else {
        if (
          !params.p_city &&
          !params.p_exclude_city &&
          !params.p_exclude_city_in
        ) {
          params.p_city = location.toLowerCase().trim();
        }
      }
    }
  }

  params.p_lat = lat;
  params.p_lng = lng;

  params.p_radius_m =
    typeof dsl.geo?.radius_m === "number" ? Math.round(dsl.geo.radius_m) : null;

  // ----------------------------------
  // 🌍 GEO OPERATOR (FIXED)
  // ----------------------------------
  const geoOp = String(dsl.geo?.operator || "")
    .toLowerCase()
    .trim();

  params.p_outside_radius = geoOp === "outside";

  // ----------------------------------
  // 🍩 DONUT LOGIC (OUTSIDE)
  // ----------------------------------
  if (params.p_outside_radius && params.p_radius_m) {
    params.p_max_radius_m = params.p_radius_m + 50000; // +50km// 🔥 configurable
  }

  // ----------------------------------
  // 🚫 STRICT OUTSIDE → EXCLUDE CITY
  // ----------------------------------
  if (params.p_outside_radius && dsl.geo?.location_text) {
    const city = dsl.geo.location_text.toLowerCase().trim();

    // Only apply if user didn't already specify city filter
    if (!params.p_city && !params.p_city_in) {
      params.p_exclude_city_in = appendArray(params.p_exclude_city_in, [city]);
    }
  }

  for (const f of dsl.filters || []) {
    const { field, op, value: rawValue } = f;

    let value = rawValue;

    // ----------------------------------
    // ✅ Normalize numeric fields safely
    // ----------------------------------
    if (field === "price" || field === "cap_rate") {
      if (Array.isArray(value)) {
        value = value.map((v) => parseNumericValue(v));
      } else {
        value = parseNumericValue(value);
      }
    }

    // ✅ ADD HERE (very important)
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

    if (!SUPPORTED_OPS.includes(op)) {
      console.warn("⚠️ Unsupported operator:", op);
      continue;
    }

    if (field === "state") {
      const normalize = (v: string) => resolveState(v);

      if (op === "=") {
        params.p_state = normalize(value);
        params.p_state_in = null; // 🚨 prevent conflict
      }

      if (op === "!=") {
        const val = normalize(value);
        params.p_state_not_in = params.p_state_not_in
          ? [...params.p_state_not_in, val]
          : [val];
      }

      if (op === "in") {
        const vals = (Array.isArray(value) ? value : [value]).map(normalize);
        params.p_state = null;
        params.p_state_in = vals;
      }

      if (op === "not_in") {
        const vals = (Array.isArray(value) ? value : [value]).map(normalize);

        params.p_state_not_in = params.p_state_not_in
          ? [...params.p_state_not_in, ...vals]
          : vals;
      }
    }

    if (field === "city") {
      const normalizeCity = (v: string) => v.toLowerCase().trim();

      if (op === "=") {
        params.p_city = normalizeCity(value);
        params.p_city_in = null;
      }

      if (op === "!=") {
        const val = normalizeCity(value);

        params.p_exclude_city_in = params.p_exclude_city_in
          ? [...params.p_exclude_city_in, val]
          : [val];
      }

      if (op === "in") {
        params.p_city = null;
        params.p_city_in = (Array.isArray(value) ? value : [value]).map(
          normalizeCity,
        );
      }

      if (op === "not_in") {
        const vals = (Array.isArray(value) ? value : [value]).map((v: string) =>
          v.toLowerCase().trim(),
        );

        params.p_exclude_city_in = params.p_exclude_city_in
          ? [...params.p_exclude_city_in, ...vals]
          : vals;
      }
    }

    if (field === "address") {
      if (op === "=") {
        params.p_address = value;
        params.p_street_in = null;
        params.p_exclude_street_in = null; // add this
      }

      if (op === "!=") {
        params.p_exclude_address = value;
      }

      if (op === "like") {
        const clean = String(value)
          .replace(/[%_]/g, "") // remove SQL wildcards
          .toLowerCase()
          .trim();

        params.p_street_in = appendArray(params.p_street_in, [clean]);
      }

      if (op === "in") {
        const vals = (Array.isArray(value) ? value : [value]).map((v: string) =>
          v.toLowerCase().trim(),
        );
        params.p_street_in = appendArray(params.p_street_in, vals);
      }

      if (op === "not_in") {
        const vals = (Array.isArray(value) ? value : [value]).map((v: string) =>
          v.toLowerCase().trim(),
        );

        params.p_exclude_street_in = params.p_exclude_street_in
          ? [...params.p_exclude_street_in, ...vals]
          : vals;
      }

      if (op === "not_like") {
        const clean = String(value).replace(/[%_]/g, "").toLowerCase().trim();

        params.p_exclude_street_in = appendArray(params.p_exclude_street_in, [
          clean,
        ]);
      }
    }

    if (field === "type") {
      const normalizeStr = (v: string) => v.toLowerCase().trim();

      if (op === "=") {
        params.p_type = normalizeStr(value);
        params.p_type_in = null;
      }

      if (op === "!=") {
        const val = normalizeStr(value);

        params.p_exclude_type_in = params.p_exclude_type_in
          ? [...params.p_exclude_type_in, val]
          : [val];
      }

      if (op === "like") {
        const val = normalizeStr(value);
        params.p_type = val.includes("%") ? val : `%${val}%`;
        params.p_type_in = null; // prevent conflict
      }

      if (op === "not_like") {
        const val = normalizeStr(value);
        params.p_exclude_type = val.includes("%") ? val : `%${val}%`;
      }

      if (op === "in") {
        params.p_type = null;
        params.p_type_in = (Array.isArray(value) ? value : [value]).map(
          normalizeStr,
        );
      }

      if (op === "not_in") {
        params.p_exclude_type_in = (Array.isArray(value) ? value : [value]).map(
          normalizeStr,
        );
      }
    }

    if (field === "price") {
      if (op === ">" || op === ">=") {
        params.p_min_price = value;
      }

      if (op === "<" || op === "<=") {
        params.p_max_price = value;
      }

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
      if (op === ">" || op === ">=") {
        params.p_min_cap_rate = value;
      }

      if (op === "<" || op === "<=") {
        params.p_max_cap_rate = value;
      }

      if (op === "between") {
        params.p_min_cap_rate = value[0];
        params.p_max_cap_rate = value[1];
      }

      // optional future
      if (op === "not_between") {
        params.p_not_min_cap_rate = value[0];
        params.p_not_max_cap_rate = value[1];
      }
    }

    if (field === "status") {
      const normalize = (v: string) => normalizeStatusValue(v);

      // ----------------------------------
      // "=" → SINGLE OR PROMOTE TO IN
      // ----------------------------------
      if (op === "=") {
        const val = normalize(value);

        if (params.p_status && params.p_status !== val) {
          // 🔥 convert single → IN
          params.p_status_in = [params.p_status, val];
          params.p_status = null;
        } else if (params.p_status_in) {
          // 🔥 append if already IN
          if (!params.p_status_in.includes(val)) {
            params.p_status_in.push(val);
          }
        } else {
          params.p_status = val;
        }
      }

      // ----------------------------------
      // "!=" → ALWAYS ARRAY
      // ----------------------------------
      if (op === "!=") {
        const val = normalize(value);

        params.p_status_not_in = params.p_status_not_in
          ? [...params.p_status_not_in, val]
          : [val];
      }

      // ----------------------------------
      // "in"
      // ----------------------------------
      if (op === "in") {
        params.p_status = null; // prevent conflict

        params.p_status_in = Array.isArray(value)
          ? value.map(normalize)
          : [normalize(value)];
      }

      // ----------------------------------
      // "not_in"
      // ----------------------------------
      if (op === "not_in") {
        const vals = Array.isArray(value)
          ? value.map(normalize)
          : [normalize(value)];

        params.p_status_not_in = params.p_status_not_in
          ? [...params.p_status_not_in, ...vals]
          : vals;
      }
    }
  }

  return params;
}
