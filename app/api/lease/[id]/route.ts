/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

// ----------------------------------------------
// 🔐 RLS-enabled Supabase Client (Header-Based)
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // <-- service role required for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leaseId } = await params;

    if (!leaseId) {
      return NextResponse.json(
        { success: false, message: "Lease ID is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Validate session — any authenticated user can view
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ Create Supabase client with RLS headers
    const supabase = createRlsClient(rlsHeaders);

    // 4️⃣ Query secure VIEW (RLS enforces visibility)
    const { data: lease, error: leaseError } = await supabase
      .from("view_lease_property_with_user")
      .select("*")
      .eq("lease_id", leaseId)
      .single();

    if (leaseError) throw leaseError;

    const { data: contacts, error: contactError } = await supabase
      .from("contact_with_assignment")
      .select("*")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false });

    if (contactError) throw contactError;

    // 5️⃣ Audit Trail
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "READ",
      tableName: "lease",
      description: `Viewed lease for tenant: ${lease.tenant}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({ success: true, 
      data: {
        lease: lease,
        contacts: contacts
      } });
  } catch (err: any) {
    console.error("GET /lease/[id] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
