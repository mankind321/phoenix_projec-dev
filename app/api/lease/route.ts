/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

/* ============================================================
   🔐 RLS Supabase Client (Header-Based)
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
   📌 Allowed Sort Fields
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
   📌 GET — Lease List (EVERY AUTHENTICATED USER CAN VIEW)
============================================================ */
export async function GET(req: Request) {
  try {
    // 1️⃣ Validate session — ALL authenticated users can view
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️⃣ Build RLS headers
    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": user.id,
      "x-account-id": user.accountId ?? "",
    };

    // 3️⃣ Create RLS-enabled Supabase client
    const supabase = createRlsClient(rlsHeaders);

    const url = new URL(req.url);
    const params = url.searchParams;

    // Pagination
    const page = Number(params.get("page") || 1);
    const pageSize = Number(params.get("pageSize") || 20);
    const offset = (page - 1) * pageSize;

    // Filters
    const search = (params.get("search") || "").trim();
    const propertyId = params.get("propertyId");
    const userId = params.get("userId");
    const status = params.get("status");

    // Sorting
    const sortField = params.get("sortField") || "created_at";
    const sortOrder = params.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    const sortKey = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "created_at";

    // 4️⃣ Base RLS-secured query
    let query = supabase
      .from("view_lease_property_with_user")
      .select("*", { count: "exact" });

    if (propertyId) query = query.eq("property_id", propertyId);
    if (userId) query = query.eq("user_id", userId);
    if (status && status !== "all") query = query.eq("status", status);

    if (search) {
      const term = `%${search}%`;
      query = query.or(
        `tenant.ilike.${term},landlord.ilike.${term},property_name.ilike.${term},comments.ilike.${term}`
      );
    }

    query = query
      .order(sortKey, { ascending: sortOrder === "asc" })
      .range(offset, offset + pageSize - 1);

    // 5️⃣ Execute
    const { data, count, error } = await query;

    if (error) {
      console.error("Lease List Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 6️⃣ Audit Log
    await audit(
      session,
      req,
      "Viewed lease list (view_lease_property_with_user)"
    );

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error("Lease API Error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
