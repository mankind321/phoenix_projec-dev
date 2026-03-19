/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { normalizePrompt } from "@/lib/dsl/normalize";
import { mapDSLToRPC } from "@/lib/rpc/mapDSLToRPC";
import { executeSearch } from "@/lib/rpc/executeSearch";
import { CACHE_TTL_MS } from "@/lib/constants/config";

import { extractDSL } from "@/lib/ai/extractDSL";
import { fallbackDSL } from "@/lib/ai/fallbackDSL";
import { fixKnownAIIssues } from "@/lib/ai/fixDSL";

import { validateAndSanitizeDSL } from "@/lib/dsl/validateDSL";
import { relaxDSL } from "@/lib/dsl/relaxDSL";
import { scoreDSL } from "@/lib/dsl/scoreDSL";

// ----------------------------------------------
// 🔍 DSL QUALITY CHECK
// ----------------------------------------------
function isGoodDSL(dsl: any, confidence: number): boolean {
  if (!dsl) return false;

  if (!dsl.filters || dsl.filters.length === 0) return false;

  if (confidence < 0.5) return false;

  const hasMeaningfulFilter = dsl.filters.some((f: any) => {
    if (!f.value) return false;

    if (typeof f.value === "string" && f.value.replace(/%/g, "") === "") {
      return false;
    }

    return true;
  });

  return hasMeaningfulFilter;
}

function extractGeoFromText(text: string) {
  const match = text.match(
    /(\d+(\.\d+)?)\s?(mile|miles|km|kilometer|kilometers|meter|meters|m)\s+(outside|within|from)(?:\s+of)?\s+([a-z\s]+)/,
  );

  if (!match) return null;

  const distance = parseFloat(match[1]);
  const unit = match[3];
  const keyword = match[4];
  let location = match[5].trim();

  // 🔥 REMOVE leading "of"
  location = location.replace(/^of\s+/, "").trim();
  let radius_m = distance;

  if (unit.includes("mile")) radius_m = distance * 1609.34;
  else if (unit.includes("km")) radius_m = distance * 1000;
  else radius_m = distance;

  return {
    location_text: location,
    radius_m: Math.round(radius_m),
    operator: keyword === "outside" ? "outside" : "within",
  };
}

// ----------------------------------------------
// 🚀 MAIN AI SEARCH FLOW
// ----------------------------------------------
export async function runAISearch(supabase: any, userInput: string) {
  const normalized = normalizePrompt(userInput);

  let dsl: any = null;

  // ------------------------------------------
  // 🔎 1. CACHE LOOKUP
  // ------------------------------------------
  const { data: cached } = await supabase
    .from("ai_query_cache")
    .select("*")
    .eq("normalized_prompt", normalized)
    .maybeSingle();

  const isExpired =
    cached && new Date(cached.last_used).getTime() < Date.now() - CACHE_TTL_MS;

  // ------------------------------------------
  // ⚡ CACHE HIT
  // ------------------------------------------
  if (cached) {
    dsl = cached.dsl;

    // update usage stats
    await supabase
      .from("ai_query_cache")
      .update({
        hit_count: (cached.hit_count || 0) + 1,
        last_used: new Date().toISOString(),
      })
      .eq("id", cached.id);

    // ------------------------------------------
    // 🔄 BACKGROUND REFRESH (NON-BLOCKING)
    // ------------------------------------------
    if (isExpired) {
      extractDSL(userInput).then(async (newDsl) => {
        if (!newDsl) return;

        try {
          newDsl = validateAndSanitizeDSL(newDsl);
          newDsl = fixKnownAIIssues(newDsl);

          const newConfidence = scoreDSL(newDsl);

          if (isGoodDSL(newDsl, newConfidence)) {
            await supabase.from("ai_query_cache").upsert(
              {
                prompt: userInput,
                normalized_prompt: normalized,
                dsl: newDsl,
                last_used: new Date().toISOString(),
              },
              { onConflict: "normalized_prompt" },
            );
          }
        } catch (err) {
          console.error("❌ Background refresh failed:", err);
        }
      });
    }
  }

  // ------------------------------------------
  // ❌ CACHE MISS → AI
  // ------------------------------------------
  else {
    dsl = await extractDSL(userInput);
    console.log("DSL1:", dsl);
    // sanitize
    dsl = validateAndSanitizeDSL(dsl);
    console.log("DSL2:", dsl);
    // fix AI hallucinations
    dsl = fixKnownAIIssues(dsl);
    console.log("DSL3:", dsl);

    // fallback if broken
    if (!dsl || !dsl.filters?.length) {
      dsl = fallbackDSL(userInput);
    }

    const confidence = scoreDSL(dsl);

    if (confidence < 0.3) {
      dsl = fallbackDSL(userInput);
    }

    const shouldCache = isGoodDSL(dsl, confidence) && !dsl.__fallback;

    if (shouldCache) {
      await supabase.from("ai_query_cache").upsert(
        {
          prompt: userInput,
          normalized_prompt: normalized,
          dsl,
          last_used: new Date().toISOString(),
        },
        { onConflict: "normalized_prompt" },
      );
    }
  }

  const geoOverride = extractGeoFromText(userInput);

  if (geoOverride) {
    console.log("🌍 GEO OVERRIDE APPLIED:", geoOverride);

    dsl.geo = geoOverride;

    // ❌ remove wrong city filters
    dsl.filters = (dsl.filters || []).filter((f: any) => f.field !== "city");
  }

  // ----------------------------------
  // 🧠 SEMANTIC FIX: "within city"
  // ----------------------------------
  if (
    dsl.geo?.operator === "within" &&
    dsl.geo?.location_text &&
    !dsl.geo?.radius_m
  ) {
    const city = dsl.geo.location_text.toLowerCase().trim();

    console.log("🧠 Converting WITHIN → CITY FILTER:", city);

    // ✅ Replace geo with city filter
    dsl.filters = [
      ...(dsl.filters || []),
      {
        field: "city",
        op: "=",
        value: city,
      },
    ];

    // ❌ Remove geo constraint
    dsl.geo = {
      location_text: null,
      radius_m: null,
    };
  }

  // ------------------------------------------
  // 🔁 DSL → RPC
  // ------------------------------------------
  const rpcParams = await mapDSLToRPC(dsl);

  // ✅ ADD HERE
  console.log("📍 GEO BEFORE RPC:", {
    location: dsl.geo?.location_text,
    lat: rpcParams.p_lat,
    lng: rpcParams.p_lng,
    radius: rpcParams.p_radius_m,
    outside: rpcParams.p_outside_radius, // optional but useful
  });

  // ------------------------------------------
  // 🔍 EXECUTE
  // ------------------------------------------
  let { data, error } = await executeSearch(supabase, rpcParams);

  if (error) {
    throw new Error(error.message);
  }

  // ------------------------------------------
  // 🔁 AUTO RETRY (RELAX)
  // ------------------------------------------
  if (!data || data.length === 0) {
    const relaxedDSL = relaxDSL(dsl);
    const relaxedParams = await mapDSLToRPC(relaxedDSL);

    const retry = await executeSearch(supabase, relaxedParams);

    if (!retry.error && retry.data?.length) {
      data = retry.data;
      dsl = relaxedDSL;
    }
  }

  return { data, dsl };
}
