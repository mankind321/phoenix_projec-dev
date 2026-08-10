/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditTrail } from "@/lib/auditLogger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ----------------------------------------------
// 🔐 Create Supabase client using HEADER-BASED RLS
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // MUST use service role
    {
      db: { schema: "public" },
      global: { headers },
    },
  );
}

/* ==========================================================
   📌 GET — Error Monitoring (FAILED ONLY, LATEST FIRST)
========================================================== */
export async function GET(req: Request) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 3️⃣ Audit log
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "VIEW",
      tableName: "document_registry",
      description: "Viewed error monitoring list (FAILED only, latest first)",
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // 4️⃣ Query params
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 10);
    const offset = (page - 1) * pageSize;

    const search = searchParams.get("search")?.trim() || "";

    // 5️⃣ Base query — FORCE FAILED + LATEST FIRST
    let query = supabase
      .from("vw_document_registry")
      .select(
        `
      file_id,
      file_name,
      extraction_status,
      extraction_confidence_level_percentage,
      remarks,
      created_at,
      updated_at
    `,
        { count: "exact" },
      )
      // ✅ ONLY CURRENT USER
      .eq("user_id", session.user.id)
      // 🔴 HARD FILTER: FAILED ONLY
      .ilike("extraction_status", "FAILED")
      // ✅ LATEST FIRST
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    // 6️⃣ Search (applies on top of FAILED filter)
    if (search) {
      query = query.or(`file_name.ilike.%${search}%,remarks.ilike.%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error("GET Error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": user.id,
      "x-account-id": user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // ------------------------------------------
    // Detect Bulk Mode
    // ------------------------------------------
    const body = await req.json().catch(() => null);
    const ids: string[] = body?.ids ?? [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "No record IDs provided" },
        { status: 400 },
      );
    }

    // ------------------------------------------
    // Fetch first (Audit + Ownership Check)
    // ------------------------------------------
    const { data: records, error: fetchError } = await supabase
      .from("document_registry")
      .select("file_id,file_name")
      .eq("user_id", user.id) // 🔐 ownership
      .in("file_id", ids);

    if (fetchError || !records?.length) {
      return NextResponse.json(
        { success: false, message: "Record(s) not found" },
        { status: 404 },
      );
    }

    // ------------------------------------------
    // Perform Bulk Delete
    // ------------------------------------------
    const { error: deleteError } = await supabase
      .from("document_registry")
      .delete()
      .eq("user_id", user.id) // 🔐 enforce ownership again
      .in(
        "file_id",
        records.map((r) => r.file_id),
      );

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json(
        { success: false, message: deleteError.message },
        { status: 500 },
      );
    }

    // ------------------------------------------
    // Parallel Audit Trail
    // ------------------------------------------
    await Promise.all(
      records.map((rec) =>
        logAuditTrail({
          userId: user.id,
          username: user.username,
          role: user.role,
          actionType: "DELETE",
          tableName: "document_registry",
          recordId: rec.file_id,
          description: `Deleted failed extraction: ${rec.file_name}`,
          ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
          userAgent: req.headers.get("user-agent") ?? "Unknown",
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      message: `${records.length} record(s) deleted successfully`,
    });
  } catch (err: any) {
    console.error("DELETE Error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
