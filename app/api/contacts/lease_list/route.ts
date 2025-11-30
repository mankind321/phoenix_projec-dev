/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// ----------------------------------------------
// 🔐 Create RLS-enabled Supabase Client (header-based)
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // must be service role for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

export async function GET() {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ RLS role headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ RLS Supabase client
    const supabase = createRlsClient(rlsHeaders);

    // 4️⃣ SELECT properties (RLS controls visibility)
    const { data, error } = await supabase
      .from("lease")
      .select("lease_id, tenant, landlord, property_id")
      .order("tenant", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 5️⃣ Format for dropdowns / lists
    const items = (data ?? []).map((l: any) => ({
      id: l.lease_id,
      name: `Tenant: ${l.tenant} - Landlord: ${l.landlord}`,
      property_id: l.property_id,
    }));

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
