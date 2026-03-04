import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { accountId, username } = await req.json();

    if (!accountId || !username) {
      return NextResponse.json(
        { success: false, message: "Missing accountId or username" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("accounts_status")
      .update({
        account_status: "offline",
        session_id: null, // 🔥 invalidates JWT on next check
      })
      .eq("account_id", accountId)
      .eq("username", username);

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { success: false, message: "Database update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Force logout error:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}