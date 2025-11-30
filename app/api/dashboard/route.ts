export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

/* ========================================================
   🔐 Create RLS-Aware Supabase Client (Header-Based)
======================================================== */
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

// API key for Looker Studio (public analytics)
const API_KEY = process.env.DASHBOARD_API_KEY!;

export const revalidate = 60;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { searchParams } = url;

    /* ======================================================
       1️⃣ Validate Requester (Session OR API Key)
    ====================================================== */
    const apiKeyHeader = req.headers.get("x-api-key");
    const isKeyValid = apiKeyHeader && apiKeyHeader === API_KEY;

    const session = await getServerSession(authOptions);

    // No session + No API key → Block
    if (!isKeyValid && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ======================================================
       2️⃣ Build RLS headers OR public (anon) headers
    ====================================================== */

    let supabase;

    if (session?.user) {
      // Logged-in user → full header-based RLS
      const rlsHeaders = {
        "x-user-id": String(session.user.id),
        "x-app-role": session.user.role,
        "x-account-id": String(session.user.accountId ?? ""),
      };

      supabase = createRlsClient(rlsHeaders);
    } else {
      // API key (Looker Studio) → only anon but still RLS protected
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: "api" } }
      );
    }

    /* ======================================================
       3️⃣ Audit log (only logged in users)
    ====================================================== */
    if (session?.user) {
      await logAuditTrail({
        userId: session.user.id,
        username: session.user.username,
        role: session.user.role,
        actionType: "VIEW",
        tableName: "dashboard",
        description: "Viewed dashboard with filters",
        ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
        userAgent: req.headers.get("user-agent") ?? "Unknown",
      });
    }

    /* ======================================================
       4️⃣ Dashboard Filters
    ====================================================== */
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const state = searchParams.get("state");
    const propertyId = searchParams.get("propertyId");
    const leaseStatus = searchParams.get("leaseStatus");

    /* ======================================================
       5️⃣ Run Materialized View Queries
    ====================================================== */
    const [
      kpiRes,
      incomeTrendRes,
      expTrendRes,
      stateRes,
      cityRes,
      leaseStatusRes,
      incomeByPropRes,
      documentStatusRes,
      docTypeRes,
    ] = await Promise.all([
      supabase.from("vw_dashboard_kpis").select("*").single(),
      supabase.from("income_trend").select("*").order("month"),
      supabase.from("lease_expiration_trend").select("*").order("month"),
      supabase.from("properties_by_state").select("*"),
      supabase.from("properties_by_city").select("*"),
      supabase.from("lease_status_count").select("*"),
      supabase.from("income_by_property").select("*"),
      supabase.from("document_status_count").select("*"),
      supabase.from("documents_by_type").select("*"),
    ]);

    /* ======================================================
       6️⃣ Final Response
    ====================================================== */
    return NextResponse.json(
      {
        filtersApplied: {
          startDate,
          endDate,
          state,
          propertyId,
          leaseStatus,
        },
        kpi: kpiRes.data,
        charts: {
          incomeTrend: incomeTrendRes.data,
          expiringTrend: expTrendRes.data,
          propertiesByState:
            state && stateRes.data
              ? stateRes.data.filter((r: any) => r.state === state)
              : stateRes.data,

          propertiesByCity: cityRes.data,
          leaseStatus: leaseStatusRes.data,
          incomeByProperty: incomeByPropRes.data,
          documentStatus: documentStatusRes.data,
          documentsByType: docTypeRes.data,
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("Dashboard API Error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
