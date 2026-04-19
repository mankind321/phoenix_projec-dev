import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";
process.env.GAX_GCN_DISALLOW_IPv6 = "true";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { createRlsClient } from "@/lib/services/supabase";
import { isAiQuery } from "@/lib/ai/aiDetection";
import { runAISearch } from "@/lib/usecase/aiSearch";
import { getSignedUrl } from "@/lib/services/storage";
import { ALLOWED_SORT_FIELDS } from "@/lib/constants/config";
import { normalizeStateValue } from "@/lib/dsl/normalize";

export async function GET(req: Request) {
  try {
    console.log("🟡 API HIT");

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.warn("⛔ Unauthorized request");
      return NextResponse.json({ success: false }, { status: 401 });
    }

    console.log("👤 USER:", session.user.id);

    const supabase = createRlsClient({
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    });

    const { searchParams } = new URL(req.url);

    const rawSearch = searchParams.get("search") || "";
    const queryText = searchParams.get("query");

    const userInput = queryText || rawSearch;

    console.log("🔎 USER INPUT:", userInput);

    const aiDetected = isAiQuery(userInput);
    const aiTriggered = Boolean(userInput && aiDetected);

    console.log("🤖 AI DETECTED:", aiDetected);
    console.log("🚀 AI TRIGGERED:", aiTriggered);

    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 9;
    const offset = (page - 1) * limit;

    console.log("📄 PAGINATION:", { page, limit, offset });

    const sortField = searchParams.get("sortField") || "property_created_at";
    const sortOrder =
      (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc"
        ? "asc"
        : "desc";

    const field = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "property_created_at";

    console.log("📊 SORT:", { sortField, field, sortOrder });

    // =======================================================
    // 🤖 AI SEARCH
    // =======================================================
    if (aiTriggered) {
      console.log("🤖 USING AI SEARCH");

      const { data, dsl } = await runAISearch(supabase, userInput);

      console.log("🧠 DSL RESULT:", JSON.stringify(dsl, null, 2));
      console.log("📊 AI DATA COUNT:", data?.length || 0);

      const signed = await Promise.all(
        (data || []).map(async (p: any) => ({
          ...p,
          file_url: p.file_url ? await getSignedUrl(p.file_url) : null,
        })),
      );

      return NextResponse.json({
        success: true,
        data: signed,
        dsl,
        total: data?.length ?? 0,
        page,
        limit,
      });
    }

    // =======================================================
    // 📄 TRADITIONAL SEARCH
    // =======================================================
    console.log("📄 USING TRADITIONAL SEARCH");

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
        longitude,
        tenancytype
      `,
        { count: "exact" },
      )
      .neq("status", "Review");

    if (userInput && userInput.trim().length > 0) {
      const safe = userInput
        .trim()
        .replace(/[%_]/g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

      console.log("🧹 SANITIZED INPUT:", safe);

      const { abbr, full } = normalizeStateValue(safe);

      const orFilter = [
        `name.ilike.%${safe}%`,
        `address.ilike.%${safe}%`,
        `city.ilike.%${safe}%`,
        `state.ilike.%${safe}%`,
        ...(full ? [`state.ilike.%${full}%`] : []),
        ...(abbr ? [`state.ilike.%${abbr}%`] : []), // ✅ CRITICAL
        `type.ilike.%${safe}%`,
        `status.ilike.%${safe}%`,
        `tenancytype.ilike.%${safe}%`,
      ].join(",");

      console.log("🔗 OR FILTER:", orFilter);

      query = query.or(orFilter);
    }

    query = query.order(field, { ascending: sortOrder === "asc" });
    query = query.range(offset, offset + limit - 1);

    console.log("🚀 EXECUTING QUERY...");

    const { data, count, error } = await query;

    if (error) {
      console.error("❌ SUPABASE ERROR:", error);
      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    console.log("📊 DB RESULT COUNT:", data?.length || 0);
    console.log("📊 TOTAL COUNT:", count);

    const signedData = await Promise.all(
      (data || []).map(async (p: any) => ({
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
