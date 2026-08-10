/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ----------------------------------------------
// 🔐 Create Supabase client using HEADER-BASED RLS
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "public" },
      global: { headers },
    },
  );
}

/* ==========================================================
   📌 GET — FAILED Document Registry TOTAL COUNT ONLY
========================================================== */
export async function GET(req: Request) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ Apply RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 3️⃣ Query params (search only)
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";

    // 4️⃣ Build count query — FORCE FAILED ONLY
    let query = supabase
      .from("vw_document_registry")
      .select("*", {
        count: "exact",
        head: true, // only count returned
      })
      .eq("user_id", session.user.id)
      .eq("extraction_status", "FAILED"); // ✅ HARD FILTER

    // Optional search filter
    if (search) {
      query = query.or(
        `file_name.ilike.%${search}%,remarks.ilike.%${search}%`,
      );
    }

    const { count, error } = await query;

    if (error) {
      console.error("Count Error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    // 5️⃣ Return total FAILED count only
    return NextResponse.json({
      total: count ?? 0,
    });

  } catch (err: any) {
    console.error("GET Count Error:", err);

    return NextResponse.json(
      {
        error: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
