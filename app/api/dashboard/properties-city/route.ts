export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// 🔐 Create Supabase client WITH header-based RLS
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

export const revalidate = 60;

export async function GET(req: Request) {
  try {
    // 1️⃣ Authenticate using NextAuth
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ Create Supabase client
    const supabase = createRlsClient(rlsHeaders);

    // -------------------------------------------------------
    // 📌 DATE FILTERS (fallback = current_date)
    // -------------------------------------------------------
    const url = new URL(req.url);

    const start_date =
      url.searchParams.get("start_date") ||
      new Date().toISOString().slice(0, 10);

    const end_date =
      url.searchParams.get("end_date") ||
      new Date().toISOString().slice(0, 10);

    // -------------------------------------------------------
    // 4️⃣ Execute RPC with date filter
    // -------------------------------------------------------
    const { data, error } = await supabase.rpc("property_count_by_city", {
      userid: session.user.id,
      role: session.user.role,
      start_date,
      end_date,
    });

    if (error) throw error;

    // 🛡 Normalize array
    const normalized = Array.isArray(data) ? data : data ? [data] : [];

    return NextResponse.json(
      {
        success: true,
        propertiesByCity: normalized,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("❌ GET /api/properties-by-city error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
