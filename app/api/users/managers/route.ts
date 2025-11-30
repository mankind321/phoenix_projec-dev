/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// ❗ Admin-level API → uses service role key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "public" } }
);

export async function GET(req: Request) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Only Admin can fetch managers
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admins only" },
        { status: 403 }
      );
    }

    // 3️⃣ Fetch all managers
    const { data, error } = await supabase
      .from("account_view")
      .select("accountid, user_id, username, role, name, manager")
      .eq("role", "Manager")
      .order("accountid", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      managers: data ?? [],
    });

  } catch (err: any) {
    console.error("❌ GET /api/users/managers error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}
