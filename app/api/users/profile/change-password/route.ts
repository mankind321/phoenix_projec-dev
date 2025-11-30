/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

// Service-role is allowed because we restrict by session user ID
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "public" } }
);

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  try {
    // ------------------------------------------------
    // 1️⃣ Validate Session
    // ------------------------------------------------
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await req.json();

    // ------------------------------------------------
    // 2️⃣ Validate Inputs
    // ------------------------------------------------
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Missing fields" },
        { status: 400 }
      );
    }

    const userId = String(session.user.id);
    const user = session.user;

    // ------------------------------------------------
    // 3️⃣ Fetch account from ACCOUNTS table (correct table)
    // ------------------------------------------------
    const { data: account, error: fetchErr } = await supabase
      .from("accounts")
      .select("password_hash")
      .eq("user_id", userId)
      .single();

    if (fetchErr || !account) {
      return NextResponse.json(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    // ------------------------------------------------
    // 4️⃣ Check current password
    // ------------------------------------------------
    const valid = await bcrypt.compare(currentPassword, account.password_hash);

    if (!valid) {
      await logAuditTrail({
        userId: user.id,
        username: user.username,
        role: user.role,
        actionType: "PASSWORD_UPDATE_FAILED",
        tableName: "accounts",
        recordId: userId,
        description: "Incorrect current password",
      });

      return NextResponse.json(
        { success: false, message: "Incorrect current password" },
        { status: 400 }
      );
    }

    // ------------------------------------------------
    // 5️⃣ Hash new password
    // ------------------------------------------------
    const newHash = await bcrypt.hash(newPassword, 10);

    // ------------------------------------------------
    // 6️⃣ Update account
    // ------------------------------------------------
    const { error: updateErr } = await supabase
      .from("accounts")
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateErr) throw updateErr;

    // ------------------------------------------------
    // 7️⃣ Audit success
    // ------------------------------------------------
    await logAuditTrail({
      userId: user.id,
      username: user.username,
      role: user.role,
      actionType: "PASSWORD_UPDATE_SUCCESS",
      tableName: "accounts",
      recordId: userId,
      description: "Password updated successfully",
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("❌ Change Password Error:", err.message);

    // Fallback audit on error
    try {
      await logAuditTrail({
        userId: session?.user.id ?? null,
        username: session?.user.username,
        role: session?.user.role,
        actionType: "PASSWORD_UPDATE_FAILED",
        tableName: "accounts",
        recordId: String(session?.user?.id),
        description: `Server error: ${err.message}`,
        ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
        userAgent: req.headers.get("user-agent") ?? "Unknown",
      });
    } catch {}

    return NextResponse.json(
      { success: false, message: "Server error occurred" },
      { status: 500 }
    );
  }
}
