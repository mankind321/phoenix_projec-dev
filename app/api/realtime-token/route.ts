/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    // --------------------------------------------------
    // 🔒 AUTH VALIDATION
    // --------------------------------------------------
    if (!session?.user?.id) {
      console.warn("[realtime-token] unauthorized request");

      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!process.env.SUPABASE_JWT_SECRET) {
      console.error("[realtime-token] missing SUPABASE_JWT_SECRET");

      return NextResponse.json(
        { success: false, message: "Server misconfiguration" },
        { status: 500 },
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // --------------------------------------------------
    // 🔑 SUPABASE-COMPATIBLE JWT PAYLOAD
    // --------------------------------------------------
    const payload = {
      aud: "authenticated",
      role: "authenticated",
      sub: session.user.id, // must match auth.uid()
      email: session.user.email ?? "rt@local",
      iss: "supabase",
      iat: now,
      exp: now + 60 * 60, // 1 hour

      // ✅ REQUIRED FOR REALTIME + RLS
      app_metadata: {
        role: "authenticated",
      },

      user_metadata: {},
    };

    console.log("[realtime-token] generating token", {
      userId: session.user.id,
      hasEmail: !!session.user.email,
    });

    // --------------------------------------------------
    // ✍️ SIGN TOKEN
    // --------------------------------------------------
    const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, {
      algorithm: "HS256",
    });

    // --------------------------------------------------
    // ✅ RESPONSE
    // --------------------------------------------------
    return NextResponse.json({
      success: true,
      access_token: token,
      expires_in: 3600,
    });
  } catch (err: any) {
    console.error("[realtime-token] error:", err);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate realtime token",
      },
      { status: 500 },
    );
  }
}