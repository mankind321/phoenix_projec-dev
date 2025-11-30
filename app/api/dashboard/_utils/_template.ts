/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, authenticate, callRpcWithFilters } from "./supabaseRls";

/* ============================================================
   ⏳ 1. DEFAULT FILTER VALUES (e.g., current month)
============================================================ */
export function defaultDashboardDates() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const start = new Date(year, month, 1);                 // 1st of month
  const end = new Date(year, month + 1, 0);               // last day of month

  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

/* ============================================================
   🧹 2. Parse Dashboard Filters from Request
============================================================ */
export function parseDashboardFilters(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;

  const defaults = defaultDashboardDates();

  return {
    start_date: p.get("start_date") || defaults.start_date,
    end_date: p.get("end_date") || defaults.end_date,
    filter_state: p.get("state") || null,
    filter_property_id: p.get("property_id") || null,
    filter_lease_status: p.get("lease_status") || null,
    filter_doc_type: p.get("doc_type") || null,
  };
}

/* ============================================================
   🧪 3. Date Validation
============================================================ */
function validateDate(dateStr: any): boolean {
  if (!dateStr) return false;
  return !isNaN(Date.parse(dateStr));
}

/* ============================================================
   🏗 4. Factory: Builds the GET Endpoint
============================================================ */
export default function createDashboardEndpoint(rpcName: string) {
  return async function GET(req: Request) {
    try {
      /* ----------------------------------
         1) AUTHENTICATE USER
      ---------------------------------- */
      const auth = await authenticate();

      if (!auth.authorized) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { session, supabase } = auth;

      /* ----------------------------------
         2) PARSE FILTERS FROM URL
      ---------------------------------- */
      const filters = parseDashboardFilters(req);

      if (!validateDate(filters.start_date) || !validateDate(filters.end_date)) {
        return Response.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }

      /* ----------------------------------
         3) CALL RPC WITH FILTERS
      ---------------------------------- */
      const { data, error } = await callRpcWithFilters(
        supabase,
        rpcName,
        session,
        filters
      );

      console.log(data);

      if (error) {
        console.error(`❌ RPC Error (${rpcName}):`, error);
        return Response.json(
          { error: error.message || "RPC failed" },
          { status: 500 }
        );
      }

      /* ----------------------------------
         4) AUDIT LOG
      ---------------------------------- */
      await audit(session, req, `Dashboard → ${rpcName}`, rpcName);

      /* ----------------------------------
         5) SUCCESS RESPONSE
      ---------------------------------- */
      return Response.json({
        success: true,
        rpc: rpcName,
        filters,
        data,
      });
    } catch (err: any) {
      console.error("❌ Dashboard API Error:", err);
      return Response.json(
        { error: err?.message || "Unexpected server error" },
        { status: 500 }
      );
    }
  };
}
