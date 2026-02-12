/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditTrail } from "@/lib/auditLogger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "public" },
      global: { headers },
    }
  );
}

/* ==========================================================
   📥 GET — Error Monitoring Record
========================================================== */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ unwrap params (Next.js 14 requirement)
    const { id } = await params;

    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Create RLS client
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 3️⃣ Fetch document registry record
    const { data, error } = await supabase
      .from("document_registry")
      .select("*")
      .eq("file_id", id)
      .single();

    if (error) {
      console.error("Fetch Error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Record not found",
        },
        { status: 404 }
      );
    }

    // 4️⃣ Audit log (VIEW action)
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "VIEW",
      tableName: "document_registry",
      description: `Viewed error monitoring record (${id})`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // 5️⃣ Return formatted response
    return NextResponse.json({
      success: true,
      data: {
        document: data,
      },
    });

  } catch (err: any) {
    console.error("GET Error:", err);

    return NextResponse.json(
      {
        success: false,
        error: err.message || "Unexpected server error",
      },
      { status: 500 }
    );
  }
}


/* ==========================================================
   🗑 DELETE — Error Monitoring Record
========================================================== */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    const { error } = await supabase
      .from("document_registry")
      .delete()
      .eq("file_id", id);

    if (error) {
      console.error("Delete Error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "DELETE",
      tableName: "document_registry",
      description: `Deleted error monitoring record (${id})`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("DELETE Error:", err);

    return NextResponse.json(
      {
        success: false,
        error: err.message || "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
