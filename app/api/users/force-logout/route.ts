/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// ⚠️ ADMIN SYSTEM OPERATION — SERVICE ROLE REQUIRED
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/* ==========================================================
   📌 BULK FORCE LOGOUT USERS
   Body: { accountIds: string[] }
========================================================== */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "Admin") {
    return NextResponse.json(
      { success: false, message: "Forbidden: Admins only" },
      { status: 403 },
    );
  }

  try {
    const { accountIds } = await req.json();

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "No account IDs provided" },
        { status: 400 },
      );
    }

    // 🚫 Prevent self force-logout
    if (accountIds.includes(session.user.accountId)) {
      return NextResponse.json(
        {
          success: false,
          message: "You cannot force logout your own account.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // 🔥 BULK UPDATE accounts_status → offline
    // ============================================================
    const { error } = await supabase
      .from("accounts_status")
      .update({
        account_status: "offline",
      })
      .in("account_id", accountIds);

    if (error) throw error;

    // ============================================================
    // 🧾 AUDIT LOG — PER ACCOUNT
    // ============================================================
    for (const id of accountIds) {
      await logAuditTrail({
        userId: session.user.id,
        username: session.user.username,
        role: session.user.role,
        actionType: "FORCE_LOGOUT",
        tableName: "accounts_status",
        recordId: id,
        description: `Bulk forced logout for account ${id}`,
        ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
        userAgent: req.headers.get("user-agent") ?? "Unknown",
      });
    }

    return NextResponse.json({
      success: true,
      message: `${accountIds.length} user(s) successfully logged out`,
    });
  } catch (err: any) {
    console.error("❌ BULK FORCE LOGOUT:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 },
    );
  }
}
