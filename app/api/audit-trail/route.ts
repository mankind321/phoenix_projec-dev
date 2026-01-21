/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "public" },
      global: { headers },
    }
  );
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🔑 Session values (from your authOptions)
    const { id: userId, role, accountId } = session.user;

    // 🔥 RLS headers (still useful)
    const rlsHeaders: Record<string, string> = {
      "x-app-role": role,
      "x-user-id": userId,
      "x-account-id": accountId,
      "x-session-id": session.session_id ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);
    const url = new URL(req.url);

    // 🔍 Filters
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "10");
    const search = url.searchParams.get("search") || "";
    const action = url.searchParams.get("action") || "all";
    const user = url.searchParams.get("user") || "all";
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 📄 Base query
    let query = supabase
      .from("system_audit_trail")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // 🧠 ROLE-BASED VISIBILITY (OPTION 1)
    if (role === "Agent") {
      // Agent → own logs only
      query = query.eq("user_id", userId);
    }

    if (role === "Manager") {
      // 1️⃣ Get member user IDs
      console.log(accountId);
      const { data: members, error } = await supabase
        .from("useraccountaccess")
        .select("userid")
        .eq("manager_id", accountId);

      if (error) throw error;

      console.log(members);

      const memberIds = members?.map((m) => m.userid) ?? [];

      // 2️⃣ Include manager + members
      query = query.in("user_id", [userId, ...memberIds]);
    }

    // Admin → unrestricted

    // 🔎 Search
    if (search) {
      query = query.or(
        `username.ilike.%${search}%,` +
          `role.ilike.%${search}%,` +
          `description.ilike.%${search}%,` +
          `table_name.ilike.%${search}%`
      );
    }

    // 🎯 Action
    if (action !== "all") {
      query = query.eq("action_type", action.toUpperCase());
    }

    // 👤 UI user filter
    if (user !== "all") {
      query = query.eq("user_id", user);
    }

    // 📅 Dates
    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDate) query = query.lte("created_at", `${toDate} 23:59:59`);

    // 📄 Pagination
    query = query.range(from, to);

    // 🚀 Execute
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
    console.error("❌ audit-trail error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
