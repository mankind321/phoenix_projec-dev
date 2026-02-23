/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ----------------------------------------------
// 🔐 Header-Based RLS Supabase Client
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "api" },
      global: { headers },
    },
  );
}

// ----------------------------------------------
// POST: Check Duplicate Property via file_id
// ----------------------------------------------
export async function POST(req: Request) {
  try {
    // 1️⃣ Validate Session
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ Extract file_id
    const body = await req.json().catch(() => null);
    const fileId = body?.file_id;

    if (!fileId) {
      return NextResponse.json(
        { success: false, message: "file_id is required" },
        { status: 400 },
      );
    }

    // 3️⃣ Header-RLS Context
    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": user.id,
      "x-account-id": user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // ----------------------------------------------
    // 4️⃣ Call Property Lookup RPC
    // ----------------------------------------------
    const { data, error } = await supabase.rpc(
      "fn_lookup_document_property",
      {
        p_file_id: fileId,
      },
    );

    if (error) {
      console.error("Property Lookup RPC Error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      );
    }

    // ----------------------------------------------
    // 5️⃣ Normalize jsonb → array
    // ----------------------------------------------
    const results: any[] = Array.isArray(data) ? data : [];

    // ----------------------------------------------
    // 6️⃣ Filter ONLY existing property
    // ----------------------------------------------
    const duplicates = results.filter(
      (row) =>
        row?.exists === true &&
        row?.existing_property_id !== null
    );

    // ----------------------------------------------
    // 7️⃣ Response
    // ----------------------------------------------
    return NextResponse.json({
      success: true,
      duplicates,
    });

  } catch (err: any) {
    console.error("Duplicate Property API Error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}