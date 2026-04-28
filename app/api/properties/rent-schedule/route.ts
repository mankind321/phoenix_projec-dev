/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ----------------------------------------------
// 🔐 Create RLS-enabled Supabase Client
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
// 📥 GET Rent Schedule by Property
// ----------------------------------------------
export async function GET(req: NextRequest) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ Get query param
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "property_id is required" },
        { status: 400 },
      );
    }

    // 3️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 4️⃣ Supabase client
    const supabase = createRlsClient(rlsHeaders);

    // 5️⃣ Query rent schedule
    const { data, error } = await supabase
      .from("rentschedule")
      .select(
        `
    rent_id,
    property_id,
    term_label,
    lease_year,
    start_date,
    start_date_raw,
    end_date,
    end_date_raw,
    monthly_rent,
    annual_rent,
    rent_increase_percent,
    rent_increases,
    psf,
    cap_rate,
    created_at
  `,
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    // 6️⃣ Normalize response (optional cleanup)
    const items = (data ?? []).map((r: any) => ({
      id: r.rent_id,
      term: r.term_label,
      leaseYear: r.lease_year,
      startDate: r.start_date,
      startDateRaw: r.start_date_raw,
      endDate: r.end_date,
      endDateRaw: r.end_date_raw,
      monthlyRent: r.monthly_rent,
      annualRent: r.annual_rent,
      rentIncreasePercent: r.rent_increase_percent,
      rentIncreases: r.rent_increases,
      psf: r.psf,
      capRate: r.cap_rate,
    }));

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unexpected server error" },
      { status: 500 },
    );
  }
}
