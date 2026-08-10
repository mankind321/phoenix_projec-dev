/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

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
// 📦 Normalize Rent Schedule
// ----------------------------------------------
function normalizeRentSchedule(r: any) {
  return {
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
  };
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
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // 2️⃣ Get property ID
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json(
        {
          success: false,
          message: "property_id is required",
        },
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

    // 5️⃣ Query rent schedules
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
      console.error("Supabase GET Rent Schedule Error:", error);

      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 500 },
      );
    }

    // 6️⃣ Normalize all records
    // Do NOT filter records based on rent values.
    const items = (data ?? []).map(normalizeRentSchedule);

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (err: any) {
    console.error("GET Rent Schedule API Error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}

// ----------------------------------------------
// 📤 POST Apply Rent Schedule Changes
// ----------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // ------------------------------------------
    // 1. Validate session
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
    // 2. Parse request
    // ------------------------------------------
    const body = await req.json();

    const propertyId = body.property_id;
    const changes = body.changes;

    if (!propertyId) {
      return NextResponse.json(
        {
          success: false,
          message: "property_id is required",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(changes)) {
      return NextResponse.json(
        {
          success: false,
          message: "changes must be an array",
        },
        { status: 400 },
      );
    }

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No rent schedule changes to apply",
        data: [],
      });
    }

    // ------------------------------------------
    // 3. RLS headers
    // ------------------------------------------
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // ------------------------------------------
    // 4. Verify property
    // ------------------------------------------
    const { data: property, error: propertyError } = await supabase
      .from("property")
      .select("property_id, name")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (propertyError) {
      console.error("Property lookup error:", propertyError);

      return NextResponse.json(
        {
          success: false,
          message: propertyError.message,
        },
        { status: 500 },
      );
    }

    if (!property) {
      return NextResponse.json(
        {
          success: false,
          message: "Property not found or access denied",
        },
        { status: 404 },
      );
    }

    // ------------------------------------------
    // 5. Process changes
    // ------------------------------------------
    const results: any[] = [];

    for (const change of changes) {
      const action = change.action;

      // ======================================================
      // CREATE
      // ======================================================
      if (action === "create") {
        const startDate = change.startDate || null;
        const endDate = change.endDate || null;

        const monthlyRent =
          change.monthlyRent !== null &&
          change.monthlyRent !== undefined &&
          change.monthlyRent !== ""
            ? Number(change.monthlyRent)
            : null;

        const annualRent =
          change.annualRent !== null &&
          change.annualRent !== undefined &&
          change.annualRent !== ""
            ? Number(change.annualRent)
            : null;

        const psf =
          change.psf !== null && change.psf !== undefined && change.psf !== ""
            ? Number(change.psf)
            : null;

        const rentIncreasePercent =
          change.rentIncreasePercent !== null &&
          change.rentIncreasePercent !== undefined &&
          change.rentIncreasePercent !== ""
            ? Number(change.rentIncreasePercent)
            : null;

        const capRate =
          change.capRate !== null &&
          change.capRate !== undefined &&
          change.capRate !== ""
            ? Number(change.capRate)
            : null;

        // -------------------------------
        // Validation
        // -------------------------------
        if (!startDate) {
          return NextResponse.json(
            {
              success: false,
              message: "Start Date is required",
            },
            { status: 400 },
          );
        }

        if (endDate && new Date(endDate) < new Date(startDate)) {
          return NextResponse.json(
            {
              success: false,
              message: "End Date cannot be earlier than Start Date",
            },
            { status: 400 },
          );
        }

        if (
          (monthlyRent === null || monthlyRent <= 0) &&
          (annualRent === null || annualRent <= 0) &&
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

        for (const [name, value] of [
          ["monthlyRent", monthlyRent],
          ["annualRent", annualRent],
          ["psf", psf],
          ["rentIncreasePercent", rentIncreasePercent],
          ["capRate", capRate],
        ] as const) {
          if (value !== null && !Number.isFinite(value)) {
            return NextResponse.json(
              {
                success: false,
                message: `${name} must be a valid number`,
              },
              { status: 400 },
            );
          }
        }

        // -------------------------------
        // Payload
        // -------------------------------
        const rentScheduleId = crypto.randomUUID();

        const rentSchedulePayload = {
          rent_id: rentScheduleId,
          property_id: propertyId,

          term_label: change.term?.trim() || null,

          lease_year:
            change.leaseYear !== null &&
            change.leaseYear !== undefined &&
            change.leaseYear !== ""
              ? String(change.leaseYear).trim()
              : null,

          start_date: startDate,

          start_date_raw: change.startDateRaw?.trim() || null,

          end_date: endDate,

          end_date_raw: change.endDateRaw?.trim() || null,

          monthly_rent: monthlyRent,
          annual_rent: annualRent,

          rent_increase_percent: rentIncreasePercent,

          rent_increases: change.rentIncreases?.trim() || null,

          psf,
          cap_rate: capRate,
        };

        const { data: inserted, error: insertError } = await supabase
          .from("rentschedule")
          .insert(rentSchedulePayload)
          .select("*")
          .single();

        if (insertError) {
          console.error("Rent Schedule Insert Error:", insertError);

          return NextResponse.json(
            {
              success: false,
              message: insertError.message,
            },
            { status: 500 },
          );
        }

        await logAuditTrail({
          userId: session.user.id,
          username: session.user.username,
          role: session.user.role,
          actionType: "CREATE",
          tableName: "rentschedule",
          recordId: rentScheduleId,
          description: `Created rent schedule for property: ${
            property.name ?? propertyId
          }`,
          ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
          userAgent: req.headers.get("user-agent") ?? "Unknown",
        });

        results.push({
          action: "create",
          data: normalizeRentSchedule(inserted),
        });
      }

      // ======================================================
      // UPDATE
      // ======================================================
      else if (action === "update") {
        const rentId = change.rent_id ?? change.rent_schedule_id;

        if (!rentId) {
          return NextResponse.json(
            {
              success: false,
              message: "rent_id is required for update",
            },
            { status: 400 },
          );
        }

        const startDate = change.startDate || null;

        const endDate = change.endDate || null;

        if (!startDate) {
          return NextResponse.json(
            {
              success: false,
              message: "Start Date is required",
            },
            { status: 400 },
          );
        }

        if (endDate && new Date(endDate) < new Date(startDate)) {
          return NextResponse.json(
            {
              success: false,
              message: "End Date cannot be earlier than Start Date",
            },
            { status: 400 },
          );
        }

        const monthlyRent =
          change.monthlyRent !== null &&
          change.monthlyRent !== undefined &&
          change.monthlyRent !== ""
            ? Number(change.monthlyRent)
            : null;

        const annualRent =
          change.annualRent !== null &&
          change.annualRent !== undefined &&
          change.annualRent !== ""
            ? Number(change.annualRent)
            : null;

        const psf =
          change.psf !== null && change.psf !== undefined && change.psf !== ""
            ? Number(change.psf)
            : null;

        const rentIncreasePercent =
          change.rentIncreasePercent !== null &&
          change.rentIncreasePercent !== undefined &&
          change.rentIncreasePercent !== ""
            ? Number(change.rentIncreasePercent)
            : null;

        const capRate =
          change.capRate !== null &&
          change.capRate !== undefined &&
          change.capRate !== ""
            ? Number(change.capRate)
            : null;

        if (
          (monthlyRent === null || monthlyRent <= 0) &&
          (annualRent === null || annualRent <= 0) &&
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

        for (const [name, value] of [
          ["monthlyRent", monthlyRent],
          ["annualRent", annualRent],
          ["psf", psf],
          ["rentIncreasePercent", rentIncreasePercent],
          ["capRate", capRate],
        ] as const) {
          if (value !== null && !Number.isFinite(value)) {
            return NextResponse.json(
              {
                success: false,
                message: `${name} must be a valid number`,
              },
              { status: 400 },
            );
          }
        }

        // -------------------------------
        // Verify existing record
        // -------------------------------
        const { data: existing, error: existingError } = await supabase
          .from("rentschedule")
          .select("*")
          .eq("rent_id", rentId)
          .eq("property_id", propertyId)
          .maybeSingle();

        if (existingError) {
          return NextResponse.json(
            {
              success: false,
              message: existingError.message,
            },
            { status: 500 },
          );
        }

        if (!existing) {
          return NextResponse.json(
            {
              success: false,
              message: "Rent schedule not found or access denied",
            },
            { status: 404 },
          );
        }

        // -------------------------------
        // Update
        // -------------------------------
        const updatePayload = {
          term_label: change.term?.trim() || null,

          lease_year:
            change.leaseYear !== null &&
            change.leaseYear !== undefined &&
            change.leaseYear !== ""
              ? String(change.leaseYear).trim()
              : null,

          start_date: startDate,

          start_date_raw: change.startDateRaw?.trim() || null,

          end_date: endDate,

          end_date_raw: change.endDateRaw?.trim() || null,

          monthly_rent: monthlyRent,
          annual_rent: annualRent,

          rent_increase_percent: rentIncreasePercent,

          rent_increases: change.rentIncreases?.trim() || null,

          psf,
          cap_rate: capRate,
        };

        const { data: updated, error: updateError } = await supabase
          .from("rentschedule")
          .update(updatePayload)
          .eq("rent_id", rentId)
          .eq("property_id", propertyId)
          .select("*")
          .single();

        if (updateError) {
          console.error("Rent Schedule Update Error:", updateError);

          return NextResponse.json(
            {
              success: false,
              message: updateError.message,
            },
            { status: 500 },
          );
        }

        await logAuditTrail({
          userId: session.user.id,
          username: session.user.username,
          role: session.user.role,
          actionType: "UPDATE",
          tableName: "rentschedule",
          recordId: rentId,
          description: `Updated rent schedule for property: ${
            property.name ?? propertyId
          }`,
          ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
          userAgent: req.headers.get("user-agent") ?? "Unknown",
        });

        results.push({
          action: "update",
          data: normalizeRentSchedule(updated),
        });
      }

      // ======================================================
      // DELETE
      // ======================================================
      else if (action === "delete") {
        const rentId = change.rent_id ?? change.rent_schedule_id;

        if (!rentId) {
          return NextResponse.json(
            {
              success: false,
              message: "rent_id is required for delete",
            },
            { status: 400 },
          );
        }

        // -------------------------------
        // Verify existing record
        // -------------------------------
        const { data: existing, error: existingError } = await supabase
          .from("rentschedule")
          .select("rent_id, property_id, term_label, lease_year")
          .eq("rent_id", rentId)
          .eq("property_id", propertyId)
          .maybeSingle();

        if (existingError) {
          return NextResponse.json(
            {
              success: false,
              message: existingError.message,
            },
            { status: 500 },
          );
        }

        if (!existing) {
          return NextResponse.json(
            {
              success: false,
              message: "Rent schedule not found or access denied",
            },
            { status: 404 },
          );
        }

        // -------------------------------
        // Delete
        // -------------------------------
        const { error: deleteError } = await supabase
          .from("rentschedule")
          .delete()
          .eq("rent_id", rentId)
          .eq("property_id", propertyId);

        if (deleteError) {
          console.error("Rent Schedule Delete Error:", deleteError);

          return NextResponse.json(
            {
              success: false,
              message: deleteError.message,
            },
            { status: 500 },
          );
        }

        await logAuditTrail({
          userId: session.user.id,
          username: session.user.username,
          role: session.user.role,
          actionType: "DELETE",
          tableName: "rentschedule",
          recordId: rentId,
          description: `Deleted rent schedule: ${
            existing.term_label ?? existing.lease_year ?? rentId
          }`,
          ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
          userAgent: req.headers.get("user-agent") ?? "Unknown",
        });

        results.push({
          action: "delete",
          rent_id: rentId,
        });
      }

      // ======================================================
      // INVALID ACTION
      // ======================================================
      else {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid rent schedule action: ${action}`,
          },
          { status: 400 },
        );
      }
    }

    // ------------------------------------------
    // 6. Response
    // ------------------------------------------
    return NextResponse.json({
      success: true,
      message: "Rent schedule changes applied successfully",
      data: results,
    });
  } catch (err: any) {
    console.error("POST Rent Schedule Changes API Error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
