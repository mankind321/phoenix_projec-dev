/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> } // ✅ async params
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🎯 TARGET accountId (UUID) — from route
    const { id: targetAccountId } = await context.params;

    if (!targetAccountId) {
      return NextResponse.json(
        { success: false, message: "Missing account ID" },
        { status: 400 }
      );
    }

    // 👤 ACTOR
    const {
      id: actorUserId,
      username,
      role,
      accountId: actorAccountId,
    } = session.user;

    // 🛑 Prevent self force-logout
    if (targetAccountId === actorAccountId) {
      return NextResponse.json(
        { success: false, message: "You cannot force logout your own account." },
        { status: 400 }
      );
    }

    // 🔥 RLS headers (actor context)
    const rlsHeaders: Record<string, string> = {
      "x-app-role": role,
      "x-user-id": actorUserId,
      "x-account-id": actorAccountId,
      "x-session-id": session.session_id ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    console.log("Account ID:",targetAccountId);
    
    // 🚀 FORCE LOGOUT
    const { error } = await supabase
      .from("accounts_status")
      .update({ account_status: "offline" })
      .eq("account_id", targetAccountId);

    if (error) throw error;

    // 🧾 AUDIT TRAIL (USING YOUR BASIS)
    await logAuditTrail({
      userId: actorUserId,
      username,
      role,
      actionType: "FORCE_LOGOUT",
      tableName: "accounts_status",
      recordId: targetAccountId,
      description: `Admin forced logout for account ${targetAccountId}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      message: "Account successfully forced offline.",
    });
  } catch (err: any) {
    console.error("❌ force-logout error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
