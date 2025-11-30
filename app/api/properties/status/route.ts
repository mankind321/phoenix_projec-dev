/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// ----------------------------------------------
// 🔐 Create RLS Supabase Client (Header-Based)
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // must be service role for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

export async function GET() {
  try {
    // 1️⃣ Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ RLS-enabled Supabase client
    const supabase = createRlsClient(rlsHeaders);

    // ⭐ Every authenticated user can view property statuses
    const { data, error } = await supabase
      .from("property")
      .select("status")
      .not("status", "is", null)
      .neq("status", "")
      .order("status");

    if (error) throw error;

    const status = [...new Set(data.map((r: any) => r.status))];

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}