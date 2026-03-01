import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";
process.env.GAX_GCN_DISALLOW_IPv6 = "true";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";
import { GoogleGenerativeAI } from "@google/generative-ai";

/* ============================================================
   🔐 RLS Supabase Client
============================================================ */
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

/* ============================================================
   📝 Audit Helper
============================================================ */
async function audit(session: any, req: Request, description: string) {
  if (!session?.user) return;

  await logAuditTrail({
    userId: session.user.id,
    username: session.user.username,
    role: session.user.role,
    actionType: "VIEW",
    tableName: "view_lease_property_with_user",
    description,
    ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
    userAgent: req.headers.get("user-agent") ?? "Unknown",
  });
}

/* ============================================================
   📌 Sorting Whitelist
============================================================ */
const ALLOWED_SORT_FIELDS = new Set([
  "lease_start",
  "lease_end",
  "tenant",
  "landlord",
  "property_name",
  "status",
  "annual_rent",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🤖 Gemini Setup
============================================================ */
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);
const MODEL = "models/gemini-2.5-flash";

/* ============================================================
   🤖 AI Query Detection (Improved — Matches Property API Logic)
============================================================ */
function isAiQuery(text: string | null): boolean {
  if (!text) return false;

  const t = text.toLowerCase().trim().replace(/\s+/g, " ");

  console.log("🧠 Lease isAiQuery normalized:", JSON.stringify(t));

  // RULE 1: Question pattern
  const questionPattern =
    /^(find|show|list|get|search|which|what|leases|who)\b/i;

  if (questionPattern.test(t)) {
    console.log("🤖 Question pattern → AI search");
    return true;
  }

  // RULE 2: Lease intent keywords
  const aiKeywords = [
    "active",
    "expired",
    "expiring",
    "ending",
    "starting",
    "before",
    "after",
    "between",
    "this month",
    "next month",
    "last month",
    "next year",
    "tenant",
    "landlord",
    "property",
    "lease",
    "rent",
  ];

  const hasKeyword = aiKeywords.some((k) => t.includes(k));

  if (hasKeyword) {
    console.log("🤖 Intent keyword detected → AI search");
    return true;
  }

  // RULE 3: Everything else = Traditional
  console.log("📄 Default → Traditional search");
  return false;
}

/* ============================================================
   🤖 AI FILTER EXTRACTION
============================================================ */
async function extractLeaseFilters(prompt: string) {
  console.log("🧠 extractLeaseFilters called:", prompt);

  const model = genAI.getGenerativeModel({ model: MODEL });

  const instruction = `
You are a lease query parser.

Rules:

- If user mentions a tenant name → set "tenant"
- If user mentions a landlord name → set "landlord"
- If user mentions a property name → set "property_name"
- If user mentions:
    active → status = "active"
    expired → status = "expired"
    expiring → status = "expiring"
- If user provides only a single phrase and it does not clearly match tenant or landlord,
  treat it as "property_name".

Return ONLY valid JSON:

{
  "tenant": string | null,
  "landlord": string | null,
  "property_name": string | null,
  "status": "active" | "expired" | "expiring" | null,
  "lease_start_from": string | null,
  "lease_end_to": string | null
}

User query: "${prompt}"
`;

  const result = await model.generateContent(instruction);

  let text = result.response.text().trim();

  console.log("🧠 Gemini RAW:", text);

  if (text.startsWith("```")) {
    text = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(text);
    console.log("✅ Gemini parsed filters:", parsed);
    return parsed;
  } catch {
    console.error("❌ Gemini parse failed");

    return {
      tenant: null,
      landlord: null,
      property_name: null,
      status: null,
      lease_start_from: null,
      lease_end_to: null,
    };
  }
}

/* ============================================================
   📌 GET HANDLER
============================================================ */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = session.user;

    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": user.id,
      "x-account-id": user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    const { searchParams } = new URL(req.url);

    /* ============================================================
       SEARCH PARAMETER RESOLUTION
    ============================================================ */

    const rawSearch = searchParams.get("search") || "";
    const queryText = searchParams.get("query");

    const search =
      rawSearch || (queryText && !isAiQuery(queryText) ? queryText : "");

    const aiTriggered = Boolean(queryText && isAiQuery(queryText));

    console.log("🧾 Lease Search Resolution:", {
      rawSearch,
      queryText,
      finalSearchUsed: search,
      aiTriggered,
    });

    /* ============================================================
       PAGINATION
    ============================================================ */

    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const offset = (page - 1) * limit;

    /* ============================================================
       SORTING
    ============================================================ */

    const sortField = searchParams.get("sortField") || "created_at";

    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const field = ALLOWED_SORT_FIELDS.has(sortField) ? sortField : "created_at";

    /* ============================================================
       AI MODE
    ============================================================ */

    if (aiTriggered) {
      console.log("🤖 Lease AI search triggered");

      const filters = await extractLeaseFilters(queryText!);

      let query = supabase
        .from("view_lease_property_with_user")
        .select("*", { count: "exact" });

      if (filters.status) query = query.eq("status", filters.status);

      if (filters.tenant) query = query.ilike("tenant", `%${filters.tenant}%`);

      if (filters.landlord)
        query = query.ilike("landlord", `%${filters.landlord}%`);

      if (filters.property_name) {
        const safe = filters.property_name.replace(/[%_]/g, "");

        query = query.or(
          `property_name.ilike.%${safe}%,` +
            `property_address.ilike.%${safe}%,` +
            `property_type.ilike.%${safe}%`,
        );
      }

      if (filters.lease_start_from)
        query = query.gte("lease_start", filters.lease_start_from);

      if (filters.lease_end_to)
        query = query.lte("lease_end", filters.lease_end_to);

      query = query.order(field, {
        ascending: sortOrder === "asc",
      });

      const { data, count, error } = await query;

      if (error)
        return NextResponse.json({
          success: false,
          message: error.message,
        });

      await audit(session, req, `AI lease search: "${queryText}"`);

      return NextResponse.json({
        success: true,
        mode: "ai",
        extracted_filters: filters,
        data: data ?? [],
        total: count ?? 0,
        page,
        limit,
      });
    }

    /* ============================================================
       TRADITIONAL MODE
    ============================================================ */

    console.log("📄 Lease Traditional search executing");

    let query = supabase
      .from("view_lease_property_with_user")
      .select("*", { count: "exact" });

    if (search && search.trim().length > 0) {
      const safe = search
        .trim()
        .replace(/[%_]/g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

      console.log("🔎 Lease Raw Search Input:", search);
      console.log("🔎 Lease Sanitized Search:", safe);

      const orFilter = [
        `tenant.ilike.%${safe}%`,
        `landlord.ilike.%${safe}%`,
        `property_name.ilike.%${safe}%`,
        `property_address.ilike.%${safe}%`,
        `property_landlord.ilike.%${safe}%`,
        `property_type.ilike.%${safe}%`,
        `comments.ilike.%${safe}%`,
      ].join(",");

      console.log("🔍 Lease Traditional filter:", orFilter);

      query = query.or(orFilter);
    }

    query = query
      .order(field, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    console.log("📊 Lease Traditional Result:", {
      returned_rows: data?.length ?? 0,
      total_count: count ?? 0,
      error: error?.message ?? null,
    });

    if (error)
      return NextResponse.json({
        success: false,
        message: error.message,
      });

    await audit(session, req, "Viewed lease list");

    return NextResponse.json({
      success: true,
      mode: "traditional",
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err: any) {
    console.error("🔥 Lease API Fatal Error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message,
      },
      { status: 500 },
    );
  }
}
