// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { success: false, message: "Missing session_id" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("accounts_status")
      .update({
        revoked: true, // ✅ mark session as invalid
      })
      .eq("session_id", session_id);

    if (error) {
      console.error("Supabase logout error:", error);
      return NextResponse.json(
        { success: false, message: "Logout failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Logout successful",
    });

  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}