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
    }
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
   🤖 AI Setup
============================================================ */
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);
const MODEL = "models/gemini-2.5-flash";

/* ============================================================
   🤖 Detect Prompt-Style Search
============================================================ */
function isAiQuery(text: string | null): boolean {
  if (!text) return false;

  const t = text.toLowerCase().trim();

  if (!t.includes(" ")) return false;

  const keywords = [
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
    "last year",
    "tenant",
    "landlord",
    "property",
  ];

  return keywords.some(k => t.includes(k)) || t.split(" ").length >= 3;
}

/* ============================================================
   🤖 AI → EXISTING FILTER PARAMS
============================================================ */
async function extractLeaseFilters(prompt: string) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const instruction = `
You are a lease search query parser.

Extract filters that already exist in the system.

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

  if (text.startsWith("```")) {
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  try {
    return JSON.parse(text);
  } catch {
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
   📌 GET — Lease List
============================================================ */
export async function GET(req: Request) {
  try {
    // 1️⃣ Auth
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // 2️⃣ RLS Headers
    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": user.id,
      "x-account-id": user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    const { searchParams } = new URL(req.url);

    // Pagination
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);
    const offset = (page - 1) * pageSize;

    // Filters
    const search = (searchParams.get("search") || "").trim();
    const propertyId = searchParams.get("propertyId");
    const userId = searchParams.get("userId");
    let status = searchParams.get("status");

    // Sorting
    const sortField = searchParams.get("sortField") || "created_at";
    const sortOrder =
      searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    const sortKey = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "created_at";

    /* ============================================================
       🤖 AI MODE — map AI output → existing filters
    ============================================================ */
    let aiFilters: any = null;

    if (search && isAiQuery(search)) {
      aiFilters = await extractLeaseFilters(search);

      if (aiFilters.status) status = aiFilters.status;
    }

    /* ============================================================
       🔍 Base Query
    ============================================================ */
    let query = supabase
      .from("view_lease_property_with_user")
      .select("*", { count: "exact" });

    if (propertyId) query = query.eq("property_id", propertyId);
    if (userId) query = query.eq("user_id", userId);
    if (status && status !== "all") query = query.eq("status", status);

    // Apply AI-derived filters
    if (aiFilters?.tenant)
      query = query.ilike("tenant", `%${aiFilters.tenant}%`);

    if (aiFilters?.landlord)
      query = query.ilike("landlord", `%${aiFilters.landlord}%`);

    if (aiFilters?.property_name)
      query = query.ilike("property_name", `%${aiFilters.property_name}%`);

    if (aiFilters?.lease_start_from)
      query = query.gte("lease_start", aiFilters.lease_start_from);

    if (aiFilters?.lease_end_to)
      query = query.lte("lease_end", aiFilters.lease_end_to);

    /* ============================================================
       🔍 Traditional Search Fallback
    ============================================================ */
    if (search && !aiFilters) {
      const term = `%${search}%`;
      query = query.or(
        `tenant.ilike.${term},landlord.ilike.${term},property_name.ilike.${term},comments.ilike.${term}`
      );
    }

    query = query
      .order(sortKey, { ascending: sortOrder === "asc" })
      .range(offset, offset + pageSize - 1);

    /* ============================================================
       ▶ Execute
    ============================================================ */
    const { data, count, error } = await query;

    if (error) {
      console.error("Lease List Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await audit(
      session,
      req,
      aiFilters
        ? `AI lease search: "${search}"`
        : "Viewed lease list"
    );

    return NextResponse.json({
      mode: aiFilters ? "ai" : "traditional",
      extracted_filters: aiFilters,
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error("Lease API Fatal Error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
