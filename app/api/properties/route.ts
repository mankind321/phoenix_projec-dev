import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";
process.env.GAX_GCN_DISALLOW_IPv6 = "true";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Storage } from "@google-cloud/storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ----------------------------------------------
// 🔐 Create Supabase Client with HEADER-BASED RLS
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "api" },
      global: { headers },
    },
  );
}

function normalizeStateValue(val: string) {
  const key = val.toLowerCase().trim();
  return US_STATES[key] || US_STATES[val.toLowerCase()] || val.toUpperCase();
}

function parseNumericValue(val: any): number | any {
  if (typeof val === "number") {
    // ✅ Handle decimal percentages like 0.06 → 6
    if (val > 0 && val < 1) {
      return val * 100;
    }
    return val;
  }

  if (typeof val === "string") {
    const v = val.toLowerCase().replace(/,/g, "").trim();

    // ----------------------------------
    // ✅ Handle percentage (e.g., "6%")
    // ----------------------------------
    if (v.includes("%")) {
      const num = parseFloat(v.replace("%", ""));
      return isNaN(num) ? val : num;
    }

    // ----------------------------------
    // ✅ Handle suffix (k, m, b)
    // ----------------------------------
    const match = v.match(/^(\d+(\.\d+)?)(k|m|b)?$/);
    if (match) {
      let num = parseFloat(match[1]);
      const suffix = match[3];

      if (suffix === "k") num *= 1_000;
      if (suffix === "m") num *= 1_000_000;
      if (suffix === "b") num *= 1_000_000_000;

      return num;
    }

    // ----------------------------------
    // ✅ Handle decimal string like "0.06"
    // ----------------------------------
    const asNumber = parseFloat(v);
    if (!isNaN(asNumber)) {
      if (asNumber > 0 && asNumber < 1) {
        return asNumber * 100; // normalize to %
      }
      return asNumber;
    }

    return val;
  }

  return val;
}

// ----------------------------------------------
// AI QUERY DETECTION (FINAL PRODUCTION VERSION)
// ----------------------------------------------
function isAiQuery(text: string | null): boolean {
  if (!text) return false;

  const t = text.toLowerCase().trim().replace(/\s+/g, " ");

  console.log("🧠 isAiQuery normalized input:", JSON.stringify(t));

  // -----------------------------------------
  // 1️⃣ Detect numeric street address → NOT AI
  // -----------------------------------------
  const addressPattern = /^[\d]+\s+[a-z]/i;
  if (addressPattern.test(t)) {
    console.log("📍 Detected address pattern → Traditional search");
    return false;
  }

  // -----------------------------------------
  // 2️⃣ Financial / Investment Indicators
  // -----------------------------------------
  const financialPattern = /\b(\d+(\.\d+)?\s?(k|m|million|b|billion))\b/;
  const percentPattern = /\b\d+(\.\d+)?\s?%|\bpercent\b|\bcap rate\b/;

  const comparisonPattern =
    /\b(above|below|over|under|more than|less than|between|to|outside|at least|at most|greater than|less than or equal)\b/;

  if (
    financialPattern.test(t) ||
    percentPattern.test(t) ||
    comparisonPattern.test(t)
  ) {
    console.log("💰 Financial pattern detected → AI search");
    return true;
  }

  // -----------------------------------------
  // 2.5️⃣ Structured filter / negation detection
  // -----------------------------------------
  const negationPattern = /\b(not|exclude|without|except|outside)\b/;
  const locationFilterPattern = /\b(on|in|at)\s+[a-z]/;

  if (negationPattern.test(t) && locationFilterPattern.test(t)) {
    console.log("🧠 Structured exclusion detected → AI search");
    return true;
  }

  // -----------------------------------------
  // 3️⃣ Natural language intent keywords
  // -----------------------------------------
  const aiKeywords = [
    "near",
    "nearby",
    "around",
    "within",
    "radius",
    "distance",
    "close to",
    "next to",
    "beside",
    "km",
    "mile",
    "meter",
    "walking distance",
    "driving distance",
    "find",
    "show me",
    "search for",
    "looking for",
  ];

  if (aiKeywords.some((keyword) => t.includes(keyword))) {
    console.log("🤖 AI intent keyword detected → AI search");
    return true;
  }

  // -----------------------------------------
  // 4️⃣ Question pattern
  // -----------------------------------------
  const questionPattern = /^(where|find|show|list|get|search|what|which)\b/i;

  if (questionPattern.test(t)) {
    console.log("🤖 AI question pattern detected → AI search");
    return true;
  }

  // -----------------------------------------
  // 5️⃣ Structured query detection (SAFE)
  // -----------------------------------------
  const structuredPattern = /\b(in|on|at|with|having|where)\b/;

  if (structuredPattern.test(t) && t.split(" ").length >= 4) {
    console.log("🧠 Structured query detected → AI search");
    return true;
  }

  // -----------------------------------------
  // 🔁 SHARED DETECTION
  // -----------------------------------------
  const hasPropertyWord =
    t.includes("property") ||
    t.includes("properties") ||
    t.includes("building") ||
    t.includes("space");

  // -----------------------------------------
  // 6️⃣ Property type detection
  // -----------------------------------------
  const typeKeywords = [
    "industrial",
    "office",
    "retail",
    "mixed use",
    "multifamily",
    "apartment",
    "warehouse",
    "commercial",
    "residential",
  ];

  const hasTypeKeyword = typeKeywords.some((keyword) => t.includes(keyword));

  if (hasTypeKeyword && hasPropertyWord) {
    console.log("🏢 Structured property type query → AI search");
    return true;
  }

  // -----------------------------------------
  // 7️⃣ Status detection (FIXED)
  // -----------------------------------------
  const statusKeywords = [
    "available",
    "occupied",
    "leased",
    "sold",
    "pending",
    "off market",
    "under maintenance",
  ];

  const hasStatusKeyword = statusKeywords.some((k) =>
    new RegExp(`\\b${k}\\b`).test(t),
  );
  const hasLogicalOperator = /\b(and|or|not)\b/.test(t);

  if (
    (hasStatusKeyword && hasPropertyWord) ||
    (hasStatusKeyword && hasLogicalOperator)
  ) {
    console.log("🏷️ Structured status query → AI search");
    return true;
  }

  console.log("📄 No AI intent detected → Traditional search");
  return false;
}

function normalizeStatusValue(val: string): string | null {
  if (!val) return null;

  const v = val.toLowerCase().trim();

  // ----------------------------------
  // 🎯 STRICT MAPPING → YOUR 4 STATUSES
  // ----------------------------------
  const STATUS_MAP: Record<string, string> = {
    // ✅ AVAILABLE
    available: "Available",
    active: "Available",
    vacant: "Available",
    open: "Available",
    "for lease": "Available",
    "for rent": "Available",

    // ✅ OCCUPIED
    occupied: "Occupied",
    leased: "Occupied",
    rented: "Occupied",
    "fully occupied": "Occupied",
    "tenant occupied": "Occupied",

    // ✅ NOT AVAILABLE
    "not available": "Not Available",
    unavailable: "Not Available",
    "off market": "Not Available",
    inactive: "Not Available",
    withdrawn: "Not Available",
    "not listed": "Not Available",

    // ✅ UNDER MAINTENANCE
    maintenance: "Under Maintenance",
    "under maintenance": "Under Maintenance",
    renovation: "Under Maintenance",
    "under renovation": "Under Maintenance",
    repair: "Under Maintenance",
    "being repaired": "Under Maintenance",
  };

  // ----------------------------------
  // 1️⃣ EXACT MATCH
  // ----------------------------------
  if (STATUS_MAP[v]) {
    return STATUS_MAP[v];
  }

  // ----------------------------------
  // 2️⃣ PARTIAL MATCH (handles phrases)
  // ----------------------------------
  for (const key in STATUS_MAP) {
    if (v.includes(key)) {
      return STATUS_MAP[key];
    }
  }

  // ----------------------------------
  // 3️⃣ HARD FALLBACK (STRICT MODE)
  // ----------------------------------
  const fallback = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();

  const ALLOWED = [
    "Available",
    "Occupied",
    "Not Available",
    "Under Maintenance",
  ];

  return ALLOWED.includes(fallback) ? fallback : null;
}
// ----------------------------------------------
// 🧠 DSL EXTRACTOR (REPLACES extractParams)
// ----------------------------------------------
async function extractDSL(prompt: string) {
  console.log("🧠 extractDSL prompt:", prompt);

  const model = genAI.getGenerativeModel({ model: MODEL });

  const instruction = `
Return EXACTLY one valid JSON object. No text, no code blocks.

SCHEMA:
{
  "geo": { "location_text": string|null, "radius_m": number|null },
  "filters": [{ "field": string, "op": string, "value": any }],
  "sort": null,
  "limit": 20,
  "offset": 0
}

FIELDS (ONLY these):
type, price, cap_rate, state, city, address, status

RULES:
- Use ONLY allowed fields (map "property type"→type, "cap rate"→cap_rate)
- Operators: = != > < >= <= in not_in between not_between like not_like
- between/not_between → [min,max]; in/not_in → array
- price: convert k/m/b (2M→2000000)
- cap_rate: number (6 = 6%, NOT 0.06)
- text → LIKE (%value%)
- "on Market Street" → address like "%Market Street%"
- "not on Market Street" → address not_like "%Market Street%"
- multiple streets → address in ["..."]

SPECIAL:
- "TX and NC" → state in ["TX","NC"]
- "outside TX and NC" → state not_in ["TX","NC"]
- "not in Charlotte" → city != "Charlotte"

SORT:
- highest price → price desc
- lowest price → price asc
- best cap rate → cap_rate desc
- latest → created_at desc

LIMIT:
- singular intent → limit 1

User: "${prompt}"
`;

  const result = await model.generateContent(instruction);

  const raw = result.response.text();
  console.log("🧠 RAW DSL:", raw);

  const text = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.filters)) parsed.filters = [];
    console.log("✅ Parsed DSL:", parsed);
    return parsed;
  } catch {
    console.error("❌ DSL parse failed");
    return null;
  }
}

// ----------------------------------------------
// 🔁 DSL → RPC MAPPER
// ----------------------------------------------
async function mapDSLToRPC(dsl: any) {
  const appendArray = (arr: any[] | null, vals: any[]) =>
    arr ? [...arr, ...vals] : vals;
  console.log("🔁 Mapping DSL:", dsl);

  let lat = null;
  let lng = null;

  const params: any = {
    p_lat: null,
    p_lng: null,
    p_radius_m: null,

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

    if (dsl.geo.radius_m) {
      const geo = await geocodeLocation(location);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    // ----------------------------------
    // CASE 2: ADMIN SEARCH (CITY/STATE)
    // ----------------------------------
    else {
      console.log("🏙️ Treating location as admin filter:", location);

      const normalized = location.toLowerCase();

      // check if it's a state
      const stateCode = US_STATES[normalized];

      if (stateCode) {
        // ✅ Only apply if filters did NOT already define state
        if (!params.p_state && !params.p_state_in && !params.p_state_not_in) {
          params.p_state = stateCode;
        }
      } else {
        // assume CITY — also protect against overrides
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

    console.log("➡️ Processing filter:", f);

    if (field === "state") {
      const normalize = (v: string) => normalizeStateValue(v);

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

  console.log("📦 Final RPC Params:", params);

  return params;
}
// ----------------------------------------------
// ☁️ Google Cloud Storage
// ----------------------------------------------
const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!,
);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

async function getSignedUrl(path: string): Promise<string | null> {
  try {
    const [url] = await bucket.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return url;
  } catch (err) {
    console.error("❌ Signed URL error:", err);
    return null;
  }
}

// ----------------------------------------------
// Sorting whitelist
// ----------------------------------------------
const ALLOWED_SORT_FIELDS = new Set([
  "property_created_at",
  "property_updated_at",
  "price",
  "cap_rate",
  "name",
]);

// ----------------------------------------------
// Gemini AI Client
// ----------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);
const MODEL = "models/gemini-2.5-flash";

// ----------------------------------------------
// U.S. STATES MAP
// ----------------------------------------------
const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

// -------------------------------------------------
// GOOGLE GEOCODING WITH CACHE
// -------------------------------------------------
const GEO_CACHE = new Map<string, any>();
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

async function geocodeLocation(location: string) {
  console.log("📍 geocodeLocation() called:", location);

  const key = location.toLowerCase();
  const cached = GEO_CACHE.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    console.log("📍 Geocode cache hit:", cached);
    return cached;
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY!;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    location,
  )}&key=${apiKey}`;

  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "OK" || !json.results?.length) {
    console.warn("⚠️ Geocode failed:", json);
    return null;
  }

  const entry = {
    lat: json.results[0].geometry.location.lat,
    lng: json.results[0].geometry.location.lng,
    formatted_address: json.results[0].formatted_address,
    expiresAt: Date.now() + GEO_CACHE_TTL,
  };

  GEO_CACHE.set(key, entry);
  console.log("📍 Geocode success:", entry);

  return entry;
}

// ----------------------------------------------
// MAIN GET HANDLER
// ----------------------------------------------
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.warn("⛔ Unauthorized request");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    const { searchParams } = new URL(req.url);
    const rawSearch = searchParams.get("search") || "";
    const queryText = searchParams.get("query");

    // 🔥 UNIFY INPUT
    const userInput = queryText || rawSearch;

    // 🔥 ALWAYS RUN AI DETECTION
    const aiDetected = isAiQuery(userInput);

    // 🔥 DECIDE MODE
    const aiTriggered = Boolean(userInput && aiDetected);

    // 🔥 ROUTING
    const search = !aiTriggered ? userInput : "";

    console.log("🧾 Search Parameter Resolution:", {
      rawSearch,
      queryText,
      userInput,
      aiDetected,
      aiTriggered,
      finalSearchUsed: search,
    });
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 9;
    const offset = (page - 1) * limit;

    const sortField = searchParams.get("sortField") || "property_created_at";
    const sortOrder =
      (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc"
        ? "asc"
        : "desc";

    const field = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "property_created_at";

    console.log("🧭 Search mode:", aiTriggered ? "AI" : "TRADITIONAL");

    // =======================================================
    // 🤖 AI MODE (DSL)
    // =======================================================
    if (aiTriggered) {
      console.log("🤖 AI search triggered");

      // ------------------------------------------
      // 1. AI → DSL
      // ------------------------------------------
      const dsl = await extractDSL(userInput);

      if (!dsl) {
        console.warn("❌ DSL parsing failed");

        return NextResponse.json({
          success: false,
          message: "AI failed to parse query",
        });
      }

      // ------------------------------------------
      // 2. DSL → RPC PARAMS
      // ------------------------------------------
      const rpcParams = await mapDSLToRPC(dsl);

      console.log("📦 RPC Params Ready:", rpcParams);

      // ------------------------------------------
      // 3. EXECUTE SQL FUNCTION
      // ------------------------------------------
      const { data, error } = await supabase.rpc(
        "search_properties_by_radius",
        {
          p_lat: rpcParams.p_lat,
          p_lng: rpcParams.p_lng,
          p_radius_m: rpcParams.p_radius_m,

          p_type: rpcParams.p_type,
          p_type_in: rpcParams.p_type_in,
          p_exclude_type_in: rpcParams.p_exclude_type_in,

          p_min_price: rpcParams.p_min_price,
          p_max_price: rpcParams.p_max_price,

          // ✅ ADD THESE
          p_not_min_price: rpcParams.p_not_min_price,
          p_not_max_price: rpcParams.p_not_max_price,

          p_city: rpcParams.p_city,
          p_state: rpcParams.p_state,

          p_city_in: rpcParams.p_city_in,
          p_state_in: rpcParams.p_state_in,
          p_state_not_in: rpcParams.p_state_not_in,

          p_exclude_city: rpcParams.p_exclude_city,
          p_exclude_address: rpcParams.p_exclude_address,
          p_exclude_type: rpcParams.p_exclude_type,
          p_address: rpcParams.p_address ?? null,

          p_min_cap_rate: rpcParams.p_min_cap_rate,
          p_max_cap_rate: rpcParams.p_max_cap_rate,

          p_not_min_cap_rate: rpcParams.p_not_min_cap_rate,
          p_not_max_cap_rate: rpcParams.p_not_max_cap_rate,

          p_exclude_city_in: rpcParams.p_exclude_city_in,

          p_street_in: rpcParams.p_street_in, // ✅ ADD
          p_exclude_street_in: rpcParams.p_exclude_street_in, // ✅ ADD

          p_status: rpcParams.p_status,
          p_status_in: rpcParams.p_status_in,
          p_status_not_in: rpcParams.p_status_not_in,
        },
      );

      console.log("📊 AI RPC Result:", {
        rows: data?.length ?? 0,
        error: error?.message ?? null,
      });

      if (error) {
        console.error("❌ RPC Error:", error);

        return NextResponse.json({
          success: false,
          message: error.message,
        });
      }

      // ------------------------------------------
      // 4. SORTING
      // ------------------------------------------
      const SORT_MAP: Record<string, string> = {
        property_created_at: "created_at",
        property_updated_at: "updated_at",
        price: "price",
        cap_rate: "cap_rate",
        name: "name",
      };

      // ------------------------------------------
      // 🧭 RESOLVE SORT (DSL > QUERY PARAMS)
      // ------------------------------------------
      let dbField = "created_at";
      let direction: "asc" | "desc" = "desc";

      // 1️⃣ DSL SORT (highest priority)
      if (dsl?.sort?.field) {
        dbField = SORT_MAP[dsl.sort.field] || dsl.sort.field;
        direction = dsl.sort.direction === "asc" ? "asc" : "desc";

        console.log("🧠 Using DSL sort:", { dbField, direction });
      }
      // 2️⃣ FALLBACK TO QUERY PARAMS
      else {
        dbField = SORT_MAP[field] || "created_at";
        direction = sortOrder === "asc" ? "asc" : "desc";

        console.log("📄 Using query sort:", { dbField, direction });
      }

      // ------------------------------------------
      // 🔄 APPLY SORT
      // ------------------------------------------
      const sorted = [...(data ?? [])].sort((a: any, b: any) => {
        const valA = a?.[dbField];
        const valB = b?.[dbField];

        // Handle nulls (always last)
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        // Numeric vs string safe compare
        if (typeof valA === "number" && typeof valB === "number") {
          return direction === "asc" ? valA - valB : valB - valA;
        }

        return direction === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });

      // ------------------------------------------
      // 5. PAGINATION
      // ------------------------------------------
      const effectiveLimit = dsl?.limit ?? limit;
      const effectiveOffset = dsl?.offset ?? offset;

      console.log("📊 Effective Pagination:", {
        effectiveLimit,
        effectiveOffset,
      });

      const paginated = sorted.slice(
        effectiveOffset,
        effectiveOffset + effectiveLimit,
      );

      console.log("📄 Pagination:", {
        total: sorted.length,
        returned: paginated.length,
      });

      // ------------------------------------------
      // 6. SIGN URL
      // ------------------------------------------
      const signedData = await Promise.all(
        paginated.map(async (p: any) => ({
          ...p,
          file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
        })),
      );

      console.log("✅ AI response ready");

      return NextResponse.json({
        success: true,
        dsl,
        data: signedData,
        total: data?.length ?? 0,
        page,
        limit,
      });
    }

    // =======================================================
    // 📄 TRADITIONAL SEARCH (UNCHANGED)
    // =======================================================
    console.log("📄 Traditional search executing");

    let query = supabase
      .from("vw_property_with_image")
      .select(
        `
        property_id,
        name,
        landlord,
        address,
        city,
        state,
        type,
        status,
        price,
        cap_rate,
        file_url,
        latitude,
        longitude
      `,
        { count: "exact" },
      )
      .neq("status", "Review");

    if (search && search.trim().length > 0) {
      const safe = search
        .trim()
        .replace(/[%_]/g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

      const orFilter = [
        `name.ilike.%${safe}%`,
        `address.ilike.%${safe}%`,
        `city.ilike.%${safe}%`,
        `state.ilike.%${safe}%`,
        `type.ilike.%${safe}%`,
        `status.ilike.%${safe}%`,
      ].join(",");

      console.log("🔍 Traditional Search:", { safe });

      query = query.or(orFilter);
    }

    query = query.order(field, { ascending: sortOrder === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("❌ Traditional Error:", error);
      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    const signedData = await Promise.all(
      (data ?? []).map(async (p: any) => ({
        ...p,
        file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
      })),
    );

    return NextResponse.json({
      success: true,
      data: signedData,
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err: any) {
    console.error("🔥 API Fatal Error:", err);

    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 },
    );
  }
}
