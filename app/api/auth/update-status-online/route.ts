import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { accountId, username, session_id } = await req.json();

    if (!accountId || !username || !session_id) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("accounts_status")
      .update({
        account_status: "online",
        session_id: session_id, // 🔐 store active session
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

    return NextResponse.json({
      success: true,
      message: "User marked as online",
    });

  } catch (err) {
    console.error("Online status error:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}