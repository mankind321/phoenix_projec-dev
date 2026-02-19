/* eslint-disable @typescript-eslint/no-unused-vars */
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

// ----------------------------------------------
// AI QUERY DETECTION (FINAL PRODUCTION VERSION)
// ----------------------------------------------
function isAiQuery(text: string | null): boolean {
  if (!text) return false;

  // Normalize input
  const t = text.toLowerCase().trim().replace(/\s+/g, " "); // collapse multiple spaces

  console.log("🧠 isAiQuery normalized input:", JSON.stringify(t));

  // -------------------------------------------------
  // RULE 1: Detect address patterns → NOT AI SEARCH
  // Examples:
  //  - "351 quarry"
  //  - "123 main street"
  //  - "1000 market st"
  // -------------------------------------------------
  const addressPattern = /^[\d]+\s+[a-z]/i;
  if (addressPattern.test(t)) {
    console.log("📍 Detected address pattern → Traditional search");
    return false;
  }

  // -------------------------------------------------
  // RULE 2: Detect natural-language AI intent keywords
  // -------------------------------------------------
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
    "kilometer",
    "kilometers",
    "mile",
    "miles",
    "meter",
    "meters",
    "walking distance",
    "driving distance",

    // Intent-based phrases
    "find",
    "show me",
    "search for",
    "looking for",
    "properties in",
    "apartments in",
    "buildings in",
    "offices in",
    "commercial in",
    "for sale in",
    "for rent in",
  ];

  const hasKeyword = aiKeywords.some((keyword) => t.includes(keyword));

  if (hasKeyword) {
    console.log("🤖 AI intent keyword detected → AI search");
    return true;
  }

  // -------------------------------------------------
  // RULE 3: Detect question-based AI queries
  // -------------------------------------------------
  const questionPattern = /^(where|find|show|list|get|search|what|which)\b/i;

  if (questionPattern.test(t)) {
    console.log("🤖 AI question pattern detected → AI search");
    return true;
  }

  // -------------------------------------------------
  // RULE 4: Everything else → Traditional search
  // -------------------------------------------------
  console.log("📄 No AI intent detected → Traditional search");
  return false;
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
// AI PARAM EXTRACTOR
// -------------------------------------------------
async function extractParams(prompt: string) {
  console.log("🧠 extractParams() called with:", prompt);

  const model = genAI.getGenerativeModel({ model: MODEL });
  const instruction = `
You are an expert real-estate spatial query parser.

Extract the user's intent and convert it into structured JSON.

IMPORTANT RULES:

1. If the user specifies a radius or distance such as:
   - within X km
   - within X miles
   - near
   - nearby
   - around

   Then the mentioned place becomes a GEO-SPATIAL CENTER POINT.

   In this case:
   - Extract the place into "location"
   - Convert distance into meters → "radius_m"
   - DO NOT treat city or state as administrative filters
   - Set "city" = null
   - Set "state" = null

2. If the user says:
   - in Charlotte
   - located in Texas
   - properties in Miami

   Then:
   - Use "city" and/or "state"
   - Set "location" = null
   - Set "radius_m" = null

3. Always convert:
   - miles → meters
   - kilometers → meters

4. PROPERTY TYPE RULE:

If the user mentions a specific property type
(e.g. Fast Food, Warehouse, Office, Retail, Industrial),
extract it EXACTLY as written.

DO NOT generalize.
DO NOT convert into Commercial/Industrial categories.
DO NOT infer asset class.

Example:

"Fast food properties" →
property_type: "Fast Food"

Return ONLY valid JSON:

{
  "location": string | null,
  "radius_m": number | null,
  "property_type": string | null,
  "min_price": number | null,
  "max_price": number | null,
  "city": string | null,
  "state": string | null
}

User text: "${prompt}"
`;

  const result = await model.generateContent(instruction);

  const rawText = result.response.text();
  console.log("🧠 Gemini RAW response:", rawText);

  let text = rawText.trim();

  if (text.startsWith("```")) {
    text = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    text = text.substring(start, end + 1);
  }

  try {
    const parsed = JSON.parse(text);
    console.log("✅ Gemini parsed params:", parsed);

    return parsed;
  } catch (e) {
    console.error("❌ Gemini JSON parse failed:", text);
    return {
      location: null,
      radius_m: null,
      property_type: null,
      min_price: null,
      max_price: null,
      city: null,
      state: null,
    };
  }
}

// -------------------------------------------------
// STATE NORMALIZATION
// -------------------------------------------------
function sanitizeLocation(raw: string | null): string | null {
  if (!raw) return null;

  return raw
    .toLowerCase()
    .replace(/\b(outside|near|around|within|close to|next to)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function normalizeState(raw: string | null) {
  if (!raw) return null;

  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/state of /g, "")
    .replace(/ state$/, "")
    .replace(/, us$/, "")
    .replace(/, usa$/, "")
    .replace(/,/g, "");

  const normalized =
    US_STATES[cleaned] ||
    (/^[A-Za-z]{2}$/.test(cleaned) ? cleaned.toUpperCase() : null);

  console.log("🧭 normalizeState:", { raw, normalized });

  return normalized;
}

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

    // Decide which to use
    const search =
      rawSearch || (queryText && !isAiQuery(queryText) ? queryText : "");

    console.log("🧾 Search Parameter Resolution:", {
      rawSearch,
      queryText,
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

    console.log("🔎 Incoming request:", {
      search,
      queryText,
      page,
      limit,
      sortField,
      sortOrder,
    });

    const field = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "property_created_at";

    const aiTriggered = Boolean(queryText && isAiQuery(queryText));
    console.log("🧭 Search mode:", aiTriggered ? "AI" : "TRADITIONAL");

    // -------------------------------------------------------
    // NATURAL LANGUAGE MODE (AI QUERY)
    // -------------------------------------------------------
    if (aiTriggered) {
      console.log("🤖 AI search triggered");

      const params = await extractParams(queryText!);

      // ----------------------------------------------
      // Strip spatial modifiers from location
      // Example: "outside Charlotte, NC" → "Charlotte, NC"
      // ----------------------------------------------
      params.location = sanitizeLocation(params.location);

      // ----------------------------------------------
      // Radius detection
      // ----------------------------------------------
      const isRadiusSearch = params.radius_m !== null;

      // ----------------------------------------------
      // Normalize admin state ONLY if admin search
      // ----------------------------------------------
      if (!isRadiusSearch && params.state) {
        params.state = await normalizeState(params.state);
      }

      // ----------------------------------------------
      // VALIDATION RULE
      // Only apply for NON-radius searches
      // ----------------------------------------------
      if (!isRadiusSearch && !params.city && !params.state) {
        console.warn("⛔ AI search aborted — no valid admin location");

        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      if (params.state) {
        params.state = await normalizeState(params.state);
      }

      const loc = isRadiusSearch
        ? params.location
        : (params.city && params.state
            ? `${params.city}, ${params.state}`
            : params.city || params.state) || null;

      let geo: { lat: number; lng: number } | null = null;

      if (loc) {
        geo = await geocodeLocation(loc);
        if (!geo) {
          console.warn("⚠️ Geocoding failed");
          return NextResponse.json(
            { success: false, message: "Geocoding failed" },
            { status: 422 },
          );
        }
      }

      const { data, error } = await supabase.rpc(
        "search_properties_by_radius_with_image",
        {
          p_lat: geo?.lat ?? null,
          p_lng: geo?.lng ?? null,
          p_radius_m: geo
            ? Math.round(Number(params.radius_m ?? 1000000))
            : null,
          p_type: params.property_type,
          p_min_price: params.min_price,
          p_max_price: params.max_price,
          p_city: params.city,
          p_state: params.state,
        },
      );

      console.log("📦 AI RPC result:", {
        rows: data?.length ?? 0,
        error: error?.message,
      });

      if (error) {
        return NextResponse.json({
          success: false,
          message: error.message,
        });
      }

      const sorted = [...(data ?? [])].sort((a: any, b: any) => {
        if (sortOrder === "asc") return (a[field] ?? 0) - (b[field] ?? 0);
        return (b[field] ?? 0) - (a[field] ?? 0);
      });

      const paginated = sorted.slice(offset, offset + limit);

      const signedData = await Promise.all(
        paginated.map(async (p: any) => ({
          ...p,
          file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
        })),
      );

      console.log("✅ AI response rows:", signedData.length);

      return NextResponse.json({
        success: true,
        extracted_params: params,
        data: signedData,
        total: data?.length ?? 0,
        page,
        limit,
      });
    }

    // -------------------------------------------------------
    // TRADITIONAL SEARCH MODE
    // -------------------------------------------------------
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

    // -------------------------------------------------------
    // APPLY SEARCH FILTER SAFELY
    // -------------------------------------------------------
    if (search && search.trim().length > 0) {
      const raw = search;

      const safe = raw
        .trim()
        .replace(/[%_]/g, "") // remove wildcard breakers
        .replace(/,/g, "") // remove commas
        .replace(/\s+/g, " "); // normalize spaces

      const orFilter = [
        `name.ilike.%${safe}%`,
        `address.ilike.%${safe}%`,
        `city.ilike.%${safe}%`,
        `state.ilike.%${safe}%`,
        `type.ilike.%${safe}%`,
        `status.ilike.%${safe}%`,
      ].join(",");

      // -------------------------------
      // DEBUG LOGGING
      // -------------------------------
      console.log("🔍 Traditional Search Debug:", {
        raw_input: raw,
        sanitized_input: safe,
        or_filter_string: orFilter,
      });

      query = query.or(orFilter);
    }

    // -------------------------------------------------------
    // SORTING
    // -------------------------------------------------------
    query = query.order(field, { ascending: sortOrder === "asc" });

    // -------------------------------------------------------
    // PAGINATION
    // -------------------------------------------------------
    query = query.range(offset, offset + limit - 1);

    // -------------------------------------------------------
    // EXECUTE QUERY
    // -------------------------------------------------------
    const { data, count, error } = await query;

    // -------------------------------
    // DEBUG RESULT LOGGING
    // -------------------------------
    console.log("📊 Traditional Query Result:", {
      returned_rows: data?.length ?? 0,
      total_count: count ?? 0,
      error: error?.message ?? null,
    });

    if (error) {
      console.error("❌ Traditional Query Error:", error);
      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    // -------------------------------------------------------
    // SIGN URL PROCESSING
    // -------------------------------------------------------
    const signedData = await Promise.all(
      (data ?? []).map(async (p: any) => ({
        ...p,
        file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
      })),
    );

    // -------------------------------
    // FINAL RESPONSE LOG
    // -------------------------------
    console.log("✅ Traditional Final Response:", {
      signed_rows: signedData.length,
      page,
      limit,
    });

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
