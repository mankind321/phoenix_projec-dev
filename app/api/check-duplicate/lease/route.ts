/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ----------------------------------------------
// 🔐 Header-Based RLS Supabase Client
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  console.log("[API][RLS] headers:", headers);

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
// POST: Check Duplicate Lease via file_id
// ----------------------------------------------
export async function POST(req: Request) {
  try {
    console.log("========== [API][Duplicate Lease] START ==========");

    // 1️⃣ Validate Session
    const session = await getServerSession(authOptions);
    const user = session?.user;

    console.log("[API] session:", session);
    console.log("[API] user:", user);

    if (!user) {
      console.warn("[API] Unauthorized request");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ Extract file_id
    const body = await req.json().catch(() => null);

    console.log("[API] request body:", body);

    const fileId = body?.file_id;

    console.log("[API] fileId:", fileId);

    if (!fileId) {
      console.warn("[API] Missing file_id");
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
    // 4️⃣ Call RPC (jsonb return)
    // ----------------------------------------------
    console.log("[API] Calling RPC fn_lookup_document_leases with:", {
      p_file_id: fileId,
    });

    const { data, error } = await supabase.rpc(
      "fn_lookup_document_leases",
      {
        p_file_id: fileId,
      },
    );

    if (error) {
      console.error("[API] Lease Lookup RPC Error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      );
    }

    console.log("[API] RPC raw data:", data);

    // ----------------------------------------------
    // 5️⃣ Normalize jsonb → array
    // ----------------------------------------------
    const results: any[] = Array.isArray(data) ? data : [];

    console.log("[API] normalized results:", results);
    console.log("[API] results length:", results.length);

    // ----------------------------------------------
    // 6️⃣ Filter ONLY duplicates
    // ----------------------------------------------
    const duplicates = results.filter((row, index) => {
      const exists = row?.exists;
      const leaseId = row?.existing_lease_id;

      const isDuplicate =
        exists === true && leaseId !== null;

      console.log(`[API][ROW ${index}]`, {
        tenant: row?.tenant,
        exists,
        existing_lease_id: leaseId,
        isDuplicate,
      });

      return isDuplicate;
    });

    console.log("[API] duplicates result:", duplicates);
    console.log("[API] duplicates length:", duplicates.length);

    // ----------------------------------------------
    // 7️⃣ Response
    // ----------------------------------------------
    console.log("========== [API][Duplicate Lease] END ==========");

    return NextResponse.json({
      success: true,
      duplicates,
    });

  } catch (err: any) {
    console.error("[API] Duplicate Lease API Error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}