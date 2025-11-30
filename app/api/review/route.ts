/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

// 🔐 RLS Client Using Custom Headers
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // required for header-based RLS
    {
      db: { schema: "api" },
      global: { headers }
    }
  );
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🏷️ Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? ""
    };

    // 🔐 Supabase client (header-based RLS)
    const supabase = createRlsClient(rlsHeaders);

    const url = new URL(req.url);

    // Pagination
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Search term
    const search = url.searchParams.get("search")?.trim() || "";

    // 🔎 Base Query (RLS applies here)
    let query = supabase
      .from("vw_property_review")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // 🔍 Search Filter
    if (search.length > 0) {
      query = query.or(
        [
          `name.ilike.%${search}%`,
          `landlord.ilike.%${search}%`,
          `address.ilike.%${search}%`,
          `city.ilike.%${search}%`,
          `state.ilike.%${search}%`,
          `type.ilike.%${search}%`,
          `comments.ilike.%${search}%`,
          `creator_username.ilike.%${search}%`,
          `creator_fullname.ilike.%${search}%`,
          `manager_fullname.ilike.%${search}%`
        ].join(",")
      );
    }

    // Pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ /review query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch review properties" },
        { status: 500 }
      );
    }

    // 📝 Audit Trail
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "VIEW",
      tableName: "vw_property_review",
      description: "Viewed review property list",
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });

  } catch (err: any) {
    console.error("❌ API /review error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
