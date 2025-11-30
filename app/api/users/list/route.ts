/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// 🔐 Admin-level access (correct for user list)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    // ==========================================
    // 🔐 Validate session
    // ==========================================
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const loggedInUserId = session.user.id;

    // ==========================================
    // 🔎 Fetch current user's account role + ID
    // ==========================================
    const { data: currentUser, error: currentUserError } = await supabase
      .from("accounts")
      .select("accountid, role, manager_id")
      .eq("user_id", loggedInUserId)
      .single();

    if (currentUserError || !currentUser) {
      console.error("⚠️ User not found:", currentUserError);
      return NextResponse.json(
        { success: false, message: "User account not found" },
        { status: 404 }
      );
    }

    const { accountid, role } = currentUser;

    // ==========================================
    // 📌 Base Query
    // ==========================================
    let query = supabase
      .from("account_view")
      .select("accountid, user_id, username, role, name, manager, managerid")
      .order("name", { ascending: true });

    // ==========================================
    // 🔐 Role-based filtering
    // ==========================================
    if (role === "Admin") {
      // Admin sees everything (no filters)
    } else if (role === "Manager") {
      // Manager sees self and users where managerid == accountid
      query = query.or(`accountid.eq.${accountid},managerid.eq.${accountid}`);
    } else {
      // Agent sees only themselves
      query = query.eq("accountid", accountid);
    }

    // ==========================================
    // 📡 Execute Query
    // ==========================================
    const { data, error } = await query;
    if (error) throw error;

    // ==========================================
    // 🧹 Clean Response
    // ==========================================
    const users = (data ?? []).map((u: any) => ({
      userId: u.user_id,
      username: u.username,
      role: u.role,
      fullName: u.name || "",
      manager: u.manager || null,
    }));

    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    console.error("❌ GET /api/users/list error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}
