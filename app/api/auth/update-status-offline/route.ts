import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Incoming body:", body);

    const session_id = body?.session_id;

    if (!session_id || typeof session_id !== "string") {
      return NextResponse.json(
        { success: false, message: "Invalid or missing session_id" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("accounts_status")
      .update({ revoked: true })
      .eq("session_id", session_id);

    if (error) {
      console.error("Supabase logout error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
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