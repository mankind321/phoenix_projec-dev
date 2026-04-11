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
import { normalizeStateValue } from "@/lib/dsl/normalize";

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

Your task is to extract lease search filters from a user's natural language query.

--------------------------------------------------
Entity Extraction
--------------------------------------------------

- If the user mentions a tenant name → set "tenant"
- If the user mentions a landlord name → set "landlord"
- If the user mentions a property name → set "property_name"

--------------------------------------------------
Status Extraction
--------------------------------------------------

Map user words to the correct lease status.

IMPORTANT:
All status values MUST use **capitalized format** (first letter uppercase).

Valid statuses are:
- "Occupied"
- "Available"
- "Expired"

--------------------------------------------------

Expired status:
If the user mentions words like:

expired  
ended  
finished  
terminated  
lapsed  
past due  
already ended  
already finished  
no longer active  

→ status = "Expired"

--------------------------------------------------

Active / Expiring leases:

If the user mentions words like:

active  
expiring  
ending  
ending soon  
ongoing  
current  
running  
still active  

→ status = "Occupied"

Meaning:
- "expiring" means the lease is still active but ending soon.
- Therefore expiring leases should use status = "Occupied".

--------------------------------------------------

Available / Vacant leases:

If the user mentions words like:

available  
vacant  
open  
unoccupied  
free  

→ status = "Available"

--------------------------------------------------
Expiration Language Rule
--------------------------------------------------

If the user says phrases like:

- "expires in X years"
- "expires in X months"
- "expiring in X years"
- "expiring in X months"
- "ending in X years"
- "ending in X months"

Then:

status = "Occupied"

And calculate:

lease_end_to = current date + duration

--------------------------------------------------
Location Handling (IMPORTANT)
--------------------------------------------------

If the user mentions a location such as:

- State (e.g., "Florida", "North Carolina", "TX")
- City (e.g., "New York", "Los Angeles")
- Address or partial address

ALWAYS assign it to "property_name".

Examples:

"leases in Florida" → property_name = "Florida"  
"tenants in North Carolina" → property_name = "North Carolina"  
"leases in Dallas" → property_name = "Dallas"  
"leases at 123 Main St" → property_name = "123 Main St"

IMPORTANT:
- Do NOT create a separate "state" or "city" field
- Do NOT ignore location information
- Location must always go into "property_name"

--------------------------------------------------
Date Interpretation Rules
--------------------------------------------------

1. Relative Time

If the user mentions:

- "in X years"
- "in X months"
- "within X years"
- "within X months"

Convert to a real date relative to the current date.

Examples:

"expires in 5 years"  
→ lease_end_to = current date + 5 years

"expiring in 3 months"  
→ lease_end_to = current date + 3 months

--------------------------------------------------

2. Specific Year

Example:
"leases expiring in 2028"

Set:

status = "Occupied"  
lease_end_to = "2028-12-31"

--------------------------------------------------

3. Specific Month and Year

Example:
"leases expiring June 2027"

Set:

status = "Occupied"  
lease_end_to = last day of that month

Example result:

"2027-06-30"

--------------------------------------------------

4. Date Range

Example:
"leases from 2024 to 2026"

Set:

lease_start_from = "2024-01-01"  
lease_end_to = "2026-12-31"

--------------------------------------------------
Single Phrase Rule
--------------------------------------------------

If the user provides only a single phrase and it does not clearly match tenant or landlord,
treat it as "property_name".

--------------------------------------------------
Date Format
--------------------------------------------------

All dates must be returned in ISO format:

YYYY-MM-DD

--------------------------------------------------
Output Format
--------------------------------------------------

Return ONLY valid JSON.

{
  "tenant": string | null,
  "landlord": string | null,
  "property_name": string | null,
  "status": "Occupied" | "Available" | "Expired" | null,
  "lease_start_from": string | null,
  "lease_end_to": string | null
}

--------------------------------------------------

Current date: ${new Date().toISOString().split("T")[0]}

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
// (only showing modified sections with added logs — everything else unchanged)

/* ============================================================
   📌 GET HANDLER
============================================================ */
export async function GET(req: Request) {
  try {
    console.log("🟡 Lease API HIT");

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
       SEARCH PARAMS
    ============================================================ */

    const rawSearch = searchParams.get("search") || "";
    const queryText = searchParams.get("query");

    const search =
      rawSearch || (queryText && !isAiQuery(queryText) ? queryText : "");

    const aiTriggered = Boolean(queryText && isAiQuery(queryText));

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
    const field = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "created_at";

    /* ============================================================
       AI MODE (UNCHANGED except removed CASE)
    ============================================================ */

    if (aiTriggered) {
      const filters = await extractLeaseFilters(queryText!);

      let query = supabase
        .from("view_lease_property_with_user")
        .select("*", { count: "exact" });

      if (filters.status) query = query.eq("status", filters.status);
      if (filters.tenant)
        query = query.ilike("tenant", `%${filters.tenant}%`);
      if (filters.landlord)
        query = query.ilike("landlord", `%${filters.landlord}%`);

      if (filters.property_name) {
        const safe = filters.property_name.replace(/[%_]/g, "");
        const { abbr, full } = normalizeStateValue(safe);

        const terms = [safe];
        if (abbr && abbr !== safe) terms.push(abbr);
        if (full && full !== safe) terms.push(full);

        const conditions: string[] = [];

        for (const term of terms) {
          conditions.push(`property_name.ilike.%${term}%`);
          conditions.push(`property_address.ilike.%${term}%`);
          conditions.push(`property_type.ilike.%${term}%`);
        }

        query = query.or(conditions.join(","));
      }

      if (filters.lease_start_from)
        query = query.gte("lease_start", filters.lease_start_from);

      if (filters.lease_end_to)
        query = query.lte("lease_end", filters.lease_end_to);

      query = query
        .order(field, { ascending: sortOrder === "asc" })
        .range(offset, offset + limit - 1);

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
       TRADITIONAL MODE (FIXED + RANKING)
    ============================================================ */

    let query = supabase
      .from("view_lease_property_with_user")
      .select("*", { count: "exact" });

    if (search && search.trim().length > 0) {
      const safe = search
        .trim()
        .replace(/[%_]/g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

      const tokens = [...new Set(safe.split(" ").filter((t) => t.length > 2))];

      const conditions: string[] = [];

      for (const token of tokens) {
        conditions.push(`tenant.ilike.%${token}%`);
        conditions.push(`landlord.ilike.%${token}%`);
        conditions.push(`property_name.ilike.%${token}%`);
        conditions.push(`property_address.ilike.%${token}%`);
        conditions.push(`property_landlord.ilike.%${token}%`);
        conditions.push(`property_type.ilike.%${token}%`);
        conditions.push(`comments.ilike.%${token}%`);
      }

      const orFilter = conditions.join(",");

      query = query.or(orFilter); // ✅ FIX APPLIED
    }

    query = query
      .order(field, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error)
      return NextResponse.json({
        success: false,
        message: error.message,
      });

    /* ============================================================
       🔥 POST-FETCH RANKING (TENANT PRIORITY)
    ============================================================ */

    let ranked = data ?? [];

    if (search && ranked.length > 0) {
      const exact = search.trim().toLowerCase();

      ranked = ranked.sort((a: any, b: any) => {
        const score = (row: any) => {
          if (row.tenant?.toLowerCase() === exact) return 0;
          if (row.tenant?.toLowerCase().includes(exact)) return 1;
          if (row.landlord?.toLowerCase().includes(exact)) return 2;
          if (row.property_name?.toLowerCase().includes(exact)) return 3;
          return 4;
        };

        return score(a) - score(b);
      });
    }

    await audit(session, req, "Viewed lease list");

    return NextResponse.json({
      success: true,
      mode: "traditional",
      data: ranked,
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
