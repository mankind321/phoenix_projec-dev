/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// ----------------------------------------------
// 🔐 Create RLS-aware Supabase Client
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
// 📦 Normalize Rent Schedule
// ----------------------------------------------
function normalizeRentSchedule(r: any) {
  return {
    id: r.rent_id,
    property_id: r.property_id,

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
  };
}

// ==========================================================
// PUT — Update Rent Schedule
// ==========================================================
export async function PUT(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // ------------------------------------------
    // 1️⃣ Get ID
    // ------------------------------------------
    const { id: rentId } = await context.params;

    if (!rentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Rent schedule ID is required",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------
    // 2️⃣ Validate session
    // ------------------------------------------
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // ------------------------------------------
    // 3️⃣ Parse request
    // ------------------------------------------
    const body = await req.json();

    // ------------------------------------------
    // 4️⃣ Normalize dates
    // ------------------------------------------
    const startDate =
      body.startDate ??
      body.start_date ??
      null;

    const endDate =
      body.endDate ??
      body.end_date ??
      null;

    if (!startDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Start Date is required",
        },
        { status: 400 },
      );
    }

    // End date cannot be before start date
    if (
      endDate &&
      new Date(endDate) < new Date(startDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "End Date cannot be earlier than Start Date",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------
    // 5️⃣ Normalize numeric values
    // ------------------------------------------
    const monthlyRent =
      body.monthlyRent !== null &&
      body.monthlyRent !== undefined &&
      body.monthlyRent !== ""
        ? Number(body.monthlyRent)
        : null;

    const annualRent =
      body.annualRent !== null &&
      body.annualRent !== undefined &&
      body.annualRent !== ""
        ? Number(body.annualRent)
        : null;

    const psf =
      body.psf !== null &&
      body.psf !== undefined &&
      body.psf !== ""
        ? Number(body.psf)
        : null;

    const rentIncreasePercent =
      body.rentIncreasePercent !== null &&
      body.rentIncreasePercent !== undefined &&
      body.rentIncreasePercent !== ""
        ? Number(body.rentIncreasePercent)
        : null;

    const capRate =
      body.capRate !== null &&
      body.capRate !== undefined &&
      body.capRate !== ""
        ? Number(body.capRate)
        : null;

    // IMPORTANT:
    // lease_year is TEXT in api.rentschedule
    const leaseYear =
      body.leaseYear !== null &&
      body.leaseYear !== undefined &&
      body.leaseYear !== ""
        ? String(body.leaseYear).trim()
        : null;

    // ------------------------------------------
    // 6️⃣ Validate numeric values
    // ------------------------------------------
    const numericFields = [
      ["monthlyRent", monthlyRent],
      ["annualRent", annualRent],
      ["psf", psf],
      ["rentIncreasePercent", rentIncreasePercent],
      ["capRate", capRate],
    ] as const;

    for (const [name, value] of numericFields) {
      if (
        value !== null &&
        !Number.isFinite(value)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `${name} must be a valid number`,
          },
          { status: 400 },
        );
      }
    }

    // ------------------------------------------
    // 7️⃣ Require at least one rent value
    // ------------------------------------------
    if (
      (monthlyRent === null ||
        monthlyRent <= 0) &&
      (annualRent === null ||
        annualRent <= 0) &&
      (psf === null || psf <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "At least one of Monthly Rent, Annual Rent, or PSF is required",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------
    // 8️⃣ RLS headers
    // ------------------------------------------
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id":
        session.user.accountId ?? "",
    };

    const supabase =
      createRlsClient(rlsHeaders);

    // ------------------------------------------
    // 9️⃣ Fetch existing schedule
    // ------------------------------------------
    const {
      data: existing,
      error: fetchError,
    } = await supabase
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
        cap_rate
        `,
      )
      .eq("rent_id", rentId)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "Rent Schedule Fetch Error:",
        fetchError,
      );

      return NextResponse.json(
        {
          success: false,
          message: fetchError.message,
        },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Rent schedule not found or access denied",
        },
        { status: 404 },
      );
    }

    // ------------------------------------------
    // 🔟 Update schedule
    // ------------------------------------------
    const updatePayload = {
      term_label:
        body.term !== null &&
        body.term !== undefined &&
        body.term !== ""
          ? String(body.term).trim()
          : body.term_label !== null &&
              body.term_label !== undefined &&
              body.term_label !== ""
            ? String(body.term_label).trim()
            : null,

      // TEXT column
      lease_year: leaseYear,

      start_date: startDate,

      start_date_raw:
        body.startDateRaw ??
        body.start_date_raw ??
        null,

      end_date: endDate,

      end_date_raw:
        body.endDateRaw ??
        body.end_date_raw ??
        null,

      monthly_rent: monthlyRent,

      annual_rent: annualRent,

      rent_increase_percent:
        rentIncreasePercent,

      rent_increases:
        body.rentIncreases ??
        body.rent_increases ??
        null,

      psf,

      cap_rate: capRate,

      // ⚠️ DO NOT ADD:
      // updated_by
      // updated_at
      //
      // Those columns do not exist in your table.
    };

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from("rentschedule")
      .update(updatePayload)
      .eq("rent_id", rentId)
      .select("*")
      .single();

    if (updateError) {
      console.error(
        "Rent Schedule Update Error:",
        updateError,
      );

      return NextResponse.json(
        {
          success: false,
          message: updateError.message,
        },
        { status: 500 },
      );
    }

    // ------------------------------------------
    // 1️⃣1️⃣ Audit
    // ------------------------------------------
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "rentschedule",
      recordId: rentId,
      description: `Updated rent schedule: ${
        updated.term_label ??
        updated.lease_year ??
        rentId
      }`,
      ipAddress:
        req.headers.get("x-forwarded-for") ??
        "N/A",
      userAgent:
        req.headers.get("user-agent") ??
        "Unknown",
    });

    // ------------------------------------------
    // 1️⃣2️⃣ Response
    // ------------------------------------------
    return NextResponse.json({
      success: true,
      message:
        "Rent schedule updated successfully",
      data: normalizeRentSchedule(updated),
    });
  } catch (err: any) {
    console.error(
      "PUT Rent Schedule API Error:",
      err,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          err.message ||
          "Unexpected server error",
      },
      { status: 500 },
    );
  }
}

// ==========================================================
// DELETE — Delete Rent Schedule
// ==========================================================
export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // ------------------------------------------
    // 1️⃣ Get ID
    // ------------------------------------------
    const { id: rentId } =
      await context.params;

    if (!rentId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Rent schedule ID is required",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------
    // 2️⃣ Validate session
    // ------------------------------------------
    const session =
      await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // ------------------------------------------
    // 3️⃣ RLS headers
    // ------------------------------------------
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id":
        session.user.accountId ?? "",
    };

    const supabase =
      createRlsClient(rlsHeaders);

    // ------------------------------------------
    // 4️⃣ Fetch existing record
    // ------------------------------------------
    const {
      data: existing,
      error: fetchError,
    } = await supabase
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
        cap_rate
        `,
      )
      .eq("rent_id", rentId)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "Rent Schedule Fetch Error:",
        fetchError,
      );

      return NextResponse.json(
        {
          success: false,
          message: fetchError.message,
        },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Rent schedule not found or access denied",
        },
        { status: 404 },
      );
    }

    // ------------------------------------------
    // 5️⃣ Delete
    // ------------------------------------------
    const {
      error: deleteError,
    } = await supabase
      .from("rentschedule")
      .delete()
      .eq("rent_id", rentId);

    if (deleteError) {
      console.error(
        "Rent Schedule Delete Error:",
        deleteError,
      );

      return NextResponse.json(
        {
          success: false,
          message: deleteError.message,
        },
        { status: 500 },
      );
    }

    // ------------------------------------------
    // 6️⃣ Audit
    // ------------------------------------------
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "DELETE",
      tableName: "rentschedule",
      recordId: rentId,
      description: `Deleted rent schedule: ${
        existing.term_label ??
        existing.lease_year ??
        rentId
      }`,
      ipAddress:
        req.headers.get("x-forwarded-for") ??
        "N/A",
      userAgent:
        req.headers.get("user-agent") ??
        "Unknown",
    });

    // ------------------------------------------
    // 7️⃣ Response
    // ------------------------------------------
    return NextResponse.json({
      success: true,
      message:
        "Rent schedule deleted successfully",
    });
  } catch (err: any) {
    console.error(
      "DELETE Rent Schedule API Error:",
      err,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          err.message ||
          "Unexpected server error",
      },
      { status: 500 },
    );
  }
}