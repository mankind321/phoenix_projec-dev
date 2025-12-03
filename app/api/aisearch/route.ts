/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// -------------------------------------------------
// Supabase Client (api schema)
// -------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "api" } }
);

// -------------------------------------------------
// Gemini Clients
// -------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);
const MODEL = "models/gemini-2.5-flash";
const EMBEDDING_MODEL = "models/text-embedding-004";

// -------------------------------------------------
// HARD-CODED U.S. STATE MAP
// -------------------------------------------------
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
// KEYWORD TARGET DETECTOR
// -------------------------------------------------
function detectSearchTarget(prompt: string): "property" | "lease" | "document" | "all" {
  const p = prompt.toLowerCase();

  // EVERYTHING MODE ALWAYS WINS
  if (p.includes("all") || p.includes("everything") || p.includes("anything"))
    return "all";

  // Otherwise detect specific target
  if (p.includes("property") || p.includes("properties")) return "property";
  if (p.includes("lease") || p.includes("leases")) return "lease";
  if (p.includes("document") || p.includes("documents") || p.includes("doc")) return "document";

  return "all";
}


// -------------------------------------------------
// Helper: Extract AI Search Parameters
// -------------------------------------------------
async function extractParams(prompt: string) {
  const model = genAI.getGenerativeModel({ model: MODEL });

 const instruction = `
You are an expert real-estate query parser. Extract the user's intent and convert it into structured JSON.

CRITICAL RULES:

1. LOCATION DETECTION (EXTREMELY IMPORTANT)
- ALWAYS extract a location when ANY named place, building, or establishment is mentioned.
- Treat ANY proper noun referring to a place as a valid location.
- Examples of location types (NOT exhaustive):
  • malls and shopping centers
  • hospitals, clinics, and medical centers
  • restaurants and fast-food chains
  • hotels, resorts, casinos, inns
  • airports, train stations, bus terminals
  • schools, universities, academies
  • stadiums, arenas, convention centers
  • government buildings, embassies, city halls
  • churches, temples, mosques
  • parks, zoos, museums, attractions
  • office buildings, company headquarters
  • residential subdivisions, condos, apartments
  • ANY other named establishment or landmark

- NEVER return null for location if the text contains ANY named establishment or place.
- Infer city/state if well-known (e.g., “Disneyland” → Anaheim, CA).

2. RADIUS CONVERSION
Convert radius mentioned by user into meters:
- “500m”, “500 meters” → 500
- “1 km”, “1 kilometer” → 1000
- “1 mile”, “1 mi” → 1609
- If not mentioned, return null.

3. PROPERTY TYPE EXTRACTION
Recognize common property categories:
- Residential, Industrial, Commercial, Retail, Office, Warehouse, Land, Mixed-use
- If not found, return null.

4. PRICE EXTRACTION
Extract min_price and max_price when mentioned.

Return ONLY valid JSON in this shape:

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
  } catch {
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
// Bulletproof State Normalizer
// -------------------------------------------------
async function normalizeState(raw: string | null) {
  if (!raw) return null;

  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/state of /g, "")
    .replace(/ state$/g, "")
    .replace(/, us$/g, "")
    .replace(/, usa$/g, "")
    .replace(/,/g, "");

  if (US_STATES[cleaned]) return US_STATES[cleaned];

  if (/^[A-Za-z]{2}$/.test(cleaned)) return cleaned.toUpperCase();

  return null;
}

// -------------------------------------------------
// GEO Cache + Geocoding
// -------------------------------------------------
const GEO_CACHE = new Map();
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

// -------------------------------------------------
// Generate Embedding
// -------------------------------------------------
async function generateEmbedding(text: string) {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// -------------------------------------------------
// POST /api/aisearch (Unified Search)
// -------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = JSON.parse(await req.text());
    const userPrompt = (body.query || "").trim();
    if (!userPrompt) return NextResponse.json({ error: "Missing query" });

    const params = await extractParams(userPrompt);

    if (params.state) params.state = await normalizeState(params.state);

    console.log("🎯 Params:", params);

    const target = detectSearchTarget(userPrompt);
    console.log("🔎 Search Mode:", target);

    // -----------------------------------------------------
    // EVERYTHING MODE — return FULL dataset
    // -----------------------------------------------------
    if (target === "all") {
      console.log("🟦 EVERYTHING MODE — full dataset returned");

      const { data: allProps } = await supabase.from("property").select("*");
      const { data: allLeases } = await supabase.from("lease").select("*");
      const { data: allDocs } = await supabase.from("document").select("*");

      return NextResponse.json({
        success: true,
        meta: { query: userPrompt, target: "all" },
        results: {
          properties: allProps ?? [],
          leases: allLeases ?? [],
          documents: allDocs ?? [],
        },
      });
    }

    // -----------------------------------------------------
    // LOCATION-BASED SEARCH
    // -----------------------------------------------------
    let loc = null;
    if (params.city && params.state) loc = `${params.city}, ${params.state}`;
    else if (params.city) loc = params.city;
    else if (params.location) loc = params.location;
    else if (params.state) loc = params.state;

    if (!loc)
      return NextResponse.json(
        { error: "AI could not detect any usable location." },
        { status: 422 }
      );

    const geo = await geocodeLocation(loc);
    if (!geo) return NextResponse.json({ error: "Geocoding failed." });

    const { lat, lng } = geo;
    const radius_m = params.radius_m || 10000000;

    const queryEmbedding = await generateEmbedding(userPrompt);

    let propertyData = [];
    let leaseData = [];
    let documentData = [];

    // PROPERTY SEARCH
    if (target === "property") {
      const { data } = await supabase.rpc("search_properties_by_radius", {
        p_lat: lat,
        p_lng: lng,
        p_radius_m: radius_m,
        p_type: params.property_type,
        p_min_price: params.min_price,
        p_max_price: params.max_price,
        p_city: params.city,
        p_state: params.state,
      });
      propertyData = data ?? [];
    }

    // LEASE SEARCH
    if (target === "lease") {
      const { data } = await supabase.rpc("search_lease_vector", {
        p_query: queryEmbedding,
      });
      leaseData = data ?? [];
    }

    // DOCUMENT SEARCH
    if (target === "document") {
      const { data } = await supabase.rpc("search_document_vector", {
        p_query: queryEmbedding,
      });
      documentData = data ?? [];
    }

    return NextResponse.json({
      success: true,
      meta: { query: userPrompt, extracted_params: params, geocoded: geo, target },
      results: {
        properties: propertyData,
        leases: leaseData,
        documents: documentData,
      },
    });
  } catch (err: any) {
    console.error("💥 Unified Search Error:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
