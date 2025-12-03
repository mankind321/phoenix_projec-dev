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
    }
  );
}

function isAiQuery(text: string | null): boolean {
  if (!text) return false;

  const t = text.toLowerCase().trim();

  if (!t.includes(" ")) return false;

  const aiKeywords = [
    "near",
    "around",
    "within",
    "from",
    "close to",
    "beside",
    "next to",
    "in ",
    "km",
    "m ",
    "meter",
    "mile",
    "radius"
  ];

  if (aiKeywords.some(k => t.includes(k))) return true;

  if (t.split(" ").length >= 3) return true;

  return false;
}

// ----------------------------------------------
// ☁️ Google Cloud Storage
// ----------------------------------------------
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

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
    console.error("Signed URL error:", err);
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
  "alabama": "AL","alaska": "AK","arizona": "AZ","arkansas": "AR",
  "california": "CA","colorado": "CO","connecticut": "CT","delaware": "DE",
  "florida": "FL","georgia": "GA","hawaii": "HI","idaho": "ID",
  "illinois": "IL","indiana": "IN","iowa": "IA","kansas": "KS",
  "kentucky": "KY","louisiana": "LA","maine": "ME","maryland": "MD",
  "massachusetts": "MA","michigan": "MI","minnesota": "MN","mississippi": "MS",
  "missouri": "MO","montana": "MT","nebraska": "NE","nevada": "NV",
  "new hampshire": "NH","new jersey": "NJ","new mexico": "NM","new york": "NY",
  "north carolina": "NC","north dakota": "ND","ohio": "OH","oklahoma": "OK",
  "oregon": "OR","pennsylvania": "PA","rhode island": "RI","south carolina": "SC",
  "south dakota": "SD","tennessee": "TN","texas": "TX","utah": "UT",
  "vermont": "VT","virginia": "VA","washington": "WA","west virginia": "WV",
  "wisconsin": "WI","wyoming": "WY"
};

// -------------------------------------------------
// AI PARAM EXTRACTOR
// -------------------------------------------------
async function extractParams(prompt: string) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const instruction = `
You are an expert real-estate query parser. Extract the user's intent and convert it into structured JSON.

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
  let text = result.response.text().trim();

  if (text.startsWith("```")) {
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) text = text.substring(start, end + 1);

  try {
    return JSON.parse(text);
  } catch (e) {
    return {
      location: prompt,
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

  return (
    US_STATES[cleaned] ||
    (/^[A-Za-z]{2}$/.test(cleaned) ? cleaned.toUpperCase() : null)
  );
}

// -------------------------------------------------
// GOOGLE GEOCODING WITH CACHE
// -------------------------------------------------
const GEO_CACHE = new Map<string, any>();
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

async function geocodeLocation(location: string) {
  const key = location.toLowerCase();
  const cached = GEO_CACHE.get(key);

  if (cached && cached.expiresAt > Date.now()) return cached;

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY!;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    location
  )}&key=${apiKey}`;

  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "OK" || !json.results?.length) return null;

  const entry = {
    lat: json.results[0].geometry.location.lat,
    lng: json.results[0].geometry.location.lng,
    formatted_address: json.results[0].formatted_address,
    expiresAt: Date.now() + GEO_CACHE_TTL,
  };

  GEO_CACHE.set(key, entry);
  return entry;
}

// ----------------------------------------------
// MAIN GET HANDLER
// ----------------------------------------------
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const queryText = searchParams.get("query");
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

    // -------------------------------------------------------
    // NATURAL LANGUAGE MODE (AI QUERY)
    // -------------------------------------------------------
    if (queryText && isAiQuery(queryText)) {
      const params = await extractParams(queryText);

      if (params.state) params.state = await normalizeState(params.state);

      const loc =
        (params.city && params.state
          ? `${params.city}, ${params.state}`
          : params.city || params.location || params.state) || null;

      let geo: { lat: number; lng: number } | null = null;

      if (loc) {
        geo = await geocodeLocation(loc);
        if (!geo)
          return NextResponse.json(
            { success: false, message: "Geocoding failed" },
            { status: 422 }
          );
      }

      const { data, error } = await supabase.rpc("search_properties_by_radius_with_image", {
        p_lat: geo?.lat ?? null,
        p_lng: geo?.lng ?? null,
        p_radius_m: geo ? params.radius_m ?? 1000000 : null,
        p_type: params.property_type,
        p_min_price: params.min_price,
        p_max_price: params.max_price,
        p_city: params.city,
        p_state: params.state,
      });

      if (error)
        return NextResponse.json({ success: false, message: error.message });

      const sorted = [...(data ?? [])].sort((a: any, b: any) => {
        if (sortOrder === "asc") return (a[field] ?? 0) - (b[field] ?? 0);
        return (b[field] ?? 0) - (a[field] ?? 0);
      });

      const paginated = sorted.slice(offset, offset + limit);

      const signedData = await Promise.all(
        paginated.map(async (p: any) => ({
          ...p,
          file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
        }))
      );

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
        { count: "exact" }
      )
      .neq("status", "Review");

    if (search) {
      const safe = search.trim();
      query = query.or(
        `name.ilike.%${safe}%,address.ilike.%${safe}%,city.ilike.%${safe}%,state.ilike.%${safe}%,type.ilike.%${safe}%,status.ilike.%${safe}%`
      );
    }

    query = query.order(field, { ascending: sortOrder === "asc" });
    query = query.range(offset, offset + limit - 1);

    let { data, count, error } = await query;

    if (!error && search && (data?.length ?? 0) === 0) {
      const fallback = await supabase
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
          { count: "exact" }
        )
        .neq("status", "Review")
        .order(field, { ascending: sortOrder === "asc" })
        .range(offset, offset + limit - 1);

      data = fallback.data;
      count = fallback.count;
      error = fallback.error;
    }

    if (error)
      return NextResponse.json({ success: false, message: error.message });

    const signedData = await Promise.all(
      (data ?? []).map(async (p: any) => ({
        ...p,
        file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
      }))
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
      { status: 500 }
    );
  }
}
