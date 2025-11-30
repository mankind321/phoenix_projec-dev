/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 🔐 Service-role OK because we manually restrict user_id to session.user.id
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "api" } }
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // ❌ No login → reject
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // ===============================================
    // 🔍 Fetch the user's own profile only
    // ===============================================
    const { data: profile, error } = await supabase
      .from("usersacc")
      .select(`
        userid,
        first_name,
        middle_name,
        last_name,
        date_of_birth,
        gender,
        email,
        mobile,
        address,
        license_number,
        license_issued_by,
        license_expiration,
        profile_image_url,
        created_at,
        updated_at
      `)
      .eq("userid", userId)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    // ===============================================
    // (Optional) Get account details (username + role)
    // ===============================================
    const { data: account } = await supabase
      .from("account_view")
      .select("username, role, manager, managerid")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      user: {
        ...profile,
        username: account?.username ?? null,
        role: account?.role ?? null,
        manager: account?.manager ?? null,
        managerId: account?.managerid ?? null,
      },
    });

  } catch (err: any) {
    console.error("❌ GET /api/profile error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}
