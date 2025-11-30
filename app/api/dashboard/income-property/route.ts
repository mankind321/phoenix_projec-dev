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
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // Read filters
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId");

    const start_date =
      url.searchParams.get("start_date") || new Date().toISOString().slice(0, 10);
    const end_date =
      url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);

    // Call stored function
    const { data, error } = await supabase.rpc("property_monthly_income", {
      userid: session.user.id,
      role: session.user.role,
      start_date,
      end_date,
    });

    if (error) throw error;

    // Optional filter by property ID
    const filtered = propertyId
      ? data.filter(
          (row: any) =>
            String(row.property_id).toLowerCase() === propertyId.toLowerCase()
        )
      : data;

    return NextResponse.json(
      {
        success: true,
        incomeByProperty: filtered,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("❌ GET /api/income-property error:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
