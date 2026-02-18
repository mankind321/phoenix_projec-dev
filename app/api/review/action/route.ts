/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// 🔐 Supabase RLS client using HEADER-BASED RLS
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // required for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;

    // ❌ No session → reject
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ❌ Only ADMIN can approve/reject
    if (user.role !== "Admin" && user.role !== "Manager") {
      return NextResponse.json(
        { error: "Only admin and manager can approve or reject properties." },
        { status: 403 }
      );
    }

    // Build RLS headers (NO JWT)
    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": String(user.id),
      "x-account-id": String(user.accountId ?? ""),
    };

    const supabase = createRlsClient(rlsHeaders);

    const { propertyId, action } = await req.json();

    // Validate input
    if (!propertyId || !action) {
      return NextResponse.json(
        { error: "Missing propertyId or action" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action type" },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") ?? "N/A";
    const userAgent = req.headers.get("user-agent") ?? "Unknown";

    // ====================================================
    // 🔵 APPROVE → update property.status = Available
    // ====================================================
    if (action === "approve") {
      const { error } = await supabase
        .from("property")
        .update({
          status: "Available",
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("property_id", propertyId);

      if (error) {
        console.error("Approve Error:", error);
        return NextResponse.json(
          { error: "Failed to approve property" },
          { status: 500 }
        );
      }

      // Audit
      await logAuditTrail({
        userId: user.id,
        username: user.username,
        role: user.role,
        actionType: "APPROVE",
        tableName: "property",
        description: `Approved property ${propertyId}`,
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: "Property approved",
      });
    }

    // ====================================================
    // 🔴 REJECT → DELETE PROPERTY
    // ====================================================
    if (action === "reject") {
      const { error } = await supabase
        .from("property")
        .delete()
        .eq("property_id", propertyId);

      if (error) {
        console.error("Reject Error:", error);
        return NextResponse.json(
          { error: "Failed to delete property" },
          { status: 500 }
        );
      }

      // Audit
      await logAuditTrail({
        userId: user.id,
        username: user.username,
        role: user.role,
        actionType: "DELETE",
        tableName: "property",
        description: `Rejected + deleted property ${propertyId}`,
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: "Property rejected and deleted",
      });
    }

  } catch (err: any) {
    console.error("Property Review Error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
