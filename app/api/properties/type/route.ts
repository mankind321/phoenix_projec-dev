/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// ----------------------------------------------
// 🔐 Create Header-Based RLS Supabase Client
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // required for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

export async function GET() {
  try {
    // 1️⃣ Check logged-in user
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Prepare RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ Create RLS Supabase client
    const supabase = createRlsClient(rlsHeaders);

    // ⭐ Allowed for ALL authenticated users (your RLS will allow it)
    const { data, error } = await supabase
      .from("property")
      .select("type")
      .not("type", "is", null)
      .neq("type", "")
      .order("type");

    if (error) throw error;

    const types = [...new Set(data.map((r: any) => r.type))];

    return NextResponse.json({
      success: true,
      types,
    });
  } catch (err: any) {
    console.error("GET /property/types error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
