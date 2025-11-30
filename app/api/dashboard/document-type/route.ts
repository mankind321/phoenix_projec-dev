/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// 🔐 Create Supabase client WITH header-based RLS
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

export async function GET(req: Request) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Read query parameters
    const url = new URL(req.url);
    const start_date =
      url.searchParams.get("start_date") || new Date().toISOString().slice(0, 10);
    const end_date =
      url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);

    // Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // Call RPC with date filters
    const { data, error } = await supabase.rpc("document_by_type", {
      userid: session.user.id,
      role: session.user.role,
      start_date,
      end_date,
    });

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        documentTypes: data,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("❌ GET /api/document-by-type error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
