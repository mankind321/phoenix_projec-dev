import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { accountId, username } = await req.json();

    if (!accountId || !username) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const session_id = randomUUID();

    // 🔒 OPTIONAL: Limit to 3 active sessions
    const { data: activeSessions, error: fetchError } = await supabase
      .from("accounts_status")
      .select("session_id, created_at")
      .eq("account_id", accountId)
      .eq("revoked", false)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Fetch sessions error:", fetchError);
      return NextResponse.json(
        { success: false, message: "Failed to check sessions" },
        { status: 500 }
      );
    }

    if (activeSessions && activeSessions.length >= 3) {
      const oldestSession = activeSessions[0];

      await supabase
        .from("accounts_status")
        .update({ revoked: true })
        .eq("session_id", oldestSession.session_id);
    }

    // ✅ Insert NEW session (this is the correct behavior)
    const { error: insertError } = await supabase
      .from("accounts_status")
      .insert({
        session_id,
        account_id: accountId,
        username,
        device_info: req.headers.get("user-agent"),
        ip_address:
          req.headers.get("x-forwarded-for") ||
          req.headers.get("x-real-ip"),
        revoked: false,
        created_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(), // 30 days
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { success: false, message: "Login failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Login successful",
      session_id, // 🔐 return this to frontend
    });

  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}