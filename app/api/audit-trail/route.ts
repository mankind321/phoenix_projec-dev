/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// 🔐 Create Supabase client WITH header-based RLS
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // MUST use service role for header-based RLS
    {
      db: { schema: "public" },
      global: { headers },
    }
  );
}

export async function GET(req: Request) {
  try {
    // 1️⃣ Get NextAuth session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🔥 Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 2️⃣ Create Supabase client with headers
    const supabase = createRlsClient(rlsHeaders);

    const url = new URL(req.url);

    // 3️⃣ Extract filters
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "10");
    const search = url.searchParams.get("search") || "";
    const action = url.searchParams.get("action") || "all";
    const user = url.searchParams.get("user") || "all";
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 4️⃣ Base query
    let query = supabase
      .from("system_audit_trail")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    // 🔍 Search filter
    if (search) {
      query = query.or(
        `username.ilike.%${search}%,` +
          `role.ilike.%${search}%,` +
          `description.ilike.%${search}%,` +
          `table_name.ilike.%${search}%`
      );
    }

    // 🎯 Action filter
    if (action !== "all") {
      query = query.eq("action_type", action.toUpperCase());
    }

    // 👤 User filter
    if (user !== "all") {
      query = query.eq("user_id", user);
    }

    // 📅 Date ranges
    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDate) query = query.lte("created_at", `${toDate} 23:59:59`);

    // 5️⃣ Execute query
    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: data,
      pagination: {
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    });
  } catch (err: any) {
    console.error("❌ GET /api/audit-trail error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
