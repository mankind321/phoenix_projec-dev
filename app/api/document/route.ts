/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// ----------------------------------------------
// 🔐 Create Header-Based RLS Supabase Client
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // MUST use service_role for header RLS
    {
      db: { schema: "api" },
      global: { headers },
    },
  );
}

const ALLOWED_SORT_FIELDS = new Set([
  "uploaded_on",
  "doc_type",
  "user_name",
  "file_url",
  "created_at",
  "updated_at",
  "property_name",
  "lease_tenant",
]);

export async function GET(req: Request) {
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

    // 2️⃣ Build RLS headers
    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": user.id,
      "x-account-id": user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);
    const { searchParams } = new URL(req.url);

    // ----------------------------------
    // Pagination
    // ----------------------------------
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Number(searchParams.get("pageSize") || 10));
    const offset = (page - 1) * limit;

    // ----------------------------------
    // Filters
    // ----------------------------------
    const search = (searchParams.get("search") || "").trim();
    const propertyName = searchParams.get("propertyName") || "";
    const leaseTenant = searchParams.get("leaseTenant") || "";
    const docType = searchParams.get("docType") || "";

    // ✅ Date filters (YYYY-MM-DD)
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // ----------------------------------
    // Sorting
    // ----------------------------------
    const sortField = searchParams.get("sortField") || "uploaded_on";
    const sortOrder =
      searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";
    const sortKey = ALLOWED_SORT_FIELDS.has(sortField)
      ? sortField
      : "uploaded_on";

    // ----------------------------------
    // Base Query (RLS enforced)
    // ----------------------------------
    let query = supabase.from("document_user").select("*", { count: "exact" });

    // ----------------------------------
    // Filters
    // ----------------------------------

    if (docType && docType !== "all") {
      query = query.eq("doc_type", docType);
    }

    if (propertyName.trim()) {
      query = query.ilike("property_name", `%${propertyName}%`);
    }

    if (leaseTenant.trim()) {
      query = query.ilike("lease_tenant", `%${leaseTenant}%`);
    }

    if (search) {
      const term = `%${search}%`;
      query = query.or(
        [
          `file_url.ilike.${term}`,
          `user_name.ilike.${term}`,
          `doc_type.ilike.${term}`,
          `comments.ilike.${term}`,
          `property_name.ilike.${term}`,
          `lease_tenant.ilike.${term}`,
        ].join(","),
      );
    }

    // ----------------------------------
    // ✅ Date Range Filter (NEW)
    // ----------------------------------
    if (dateFrom) {
      query = query.gte("uploaded_on", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
      query = query.lte("uploaded_on", `${dateTo}T23:59:59.999`);
    }

    // ----------------------------------
    // Sorting & Pagination (LAST)
    // ----------------------------------
    query = query
      .order(sortKey, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // ----------------------------------
    // Execute
    // ----------------------------------
    const { data, count, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      );
    }

    const totalPages = count ? Math.ceil(count / limit) : 1;

    // ----------------------------------
    // Audit Trail
    // ----------------------------------
    await logAuditTrail({
      userId: user.id,
      username: user.username,
      role: user.role,
      actionType: "VIEW",
      tableName: "document_user",
      description: "Viewed document list",
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // ----------------------------------
    // Response
    // ----------------------------------
    return NextResponse.json({
      success: true,
      documents: data ?? [],
      total: count ?? 0,
      page,
      pageSize: limit,
      totalPages,
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
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
    // 🔀 Detect Mode: Single or Bulk Delete
    // ------------------------------------------

    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get("id");

    let ids: string[] = [];

    // BULK DELETE MODE
    if (!singleId) {
      const body = await req.json().catch(() => null);
      ids = body?.ids ?? [];

      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
          { success: false, message: "No document IDs provided" },
          { status: 400 },
        );
      }
    }

    // SINGLE DELETE MODE
    if (singleId) {
      ids = [singleId];
    }

    // ------------------------------------------
    // 3️⃣ Fetch documents first (Audit Logging)
    // ------------------------------------------

    const { data: docs, error: fetchError } = await supabase
      .from("document")
      .select("document_id,file_url")
      .in("document_id", ids);

    if (fetchError || !docs?.length) {
      return NextResponse.json(
        { success: false, message: "Document(s) not found" },
        { status: 404 },
      );
    }

    // ------------------------------------------
    // 4️⃣ Perform BULK DELETE
    // ------------------------------------------

    const { error: deleteError } = await supabase
      .from("document")
      .delete()
      .in("document_id", ids);

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json(
        { success: false, message: deleteError.message },
        { status: 500 },
      );
    }

    // ------------------------------------------
    // 5️⃣ Audit Trail (Loop)
    // ------------------------------------------

    for (const doc of docs) {
      await logAuditTrail({
        userId: user.id,
        username: user.username,
        role: user.role,
        actionType: "DELETE",
        tableName: "document",
        recordId: doc.document_id,
        description: `Deleted document: ${doc.file_url}`,
        ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
        userAgent: req.headers.get("user-agent") ?? "Unknown",
      });
    }

    return NextResponse.json({
      success: true,
      message: `${ids.length} document(s) deleted successfully`,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
