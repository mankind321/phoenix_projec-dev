/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 🔐 Create Supabase client using HEADER-BASED RLS
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

/* ==========================================================
   📌 GET — Review Property TOTAL COUNT ONLY (ALL RECORDS)
========================================================== */
export async function GET() {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
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

    // 4️⃣ COUNT ONLY query (no filters)
    const { count, error } = await supabase
      .from("lease")
      .select("*", {
        count: "exact",
        head: true, // 🚀 only returns count
      });

    if (error) {
      console.error("Tenant count error:", error);

      return NextResponse.json(
        { error: "Failed to fetch tenant count" },
        { status: 500 }
      );
    }

    // 5️⃣ Return total count
    return NextResponse.json({
      total: count ?? 0,
    });

  } catch (err: any) {
    console.error("Review count API error:", err);

    return NextResponse.json(
      { error: err.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
