/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

export type AnySupabaseClient = SupabaseClient<any, any, any>;

/* ============================================================
   ✔ 1. Build all RLS headers for RBAC
============================================================ */
export function buildRlsHeaders(session: any) {
  return {
    "x-user-id": String(session.user.id),
    "x-app-role": String(session.user.role),
    "x-account-id": String(session.user.accountId ?? ""),
  };
}

/* ============================================================
   ✔ 2. Full RLS Supabase Client (SERVICE ROLE REQUIRED)
============================================================ */
export function createRlsClientFromSession(
  session: any
): AnySupabaseClient {
  const headers = buildRlsHeaders(session);

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // REQUIRED for header override
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

/* ============================================================
   ✔ 3. Authentication wrapper for all dashboard endpoints
============================================================ */
export type AuthResult =
  | { authorized: false; session: null; supabase: null }
  | { authorized: true; session: any; supabase: AnySupabaseClient };

export async function authenticate(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      session: null,
      supabase: null,
    };
  }

  return {
    authorized: true,
    session,
    supabase: createRlsClientFromSession(session),
  };
}

/* ============================================================
   ✔ 4. Universal RPC caller (used by ALL dashboard APIs)
============================================================ */
export async function callRpcWithFilters(
  supabase: AnySupabaseClient,
  rpcName: string,
  session: any,
  filters: any
) {
  return await supabase.rpc(rpcName, {
    userid: session.user.id,
    role: session.user.role,

    // universal filters
    start_date: filters.start_date,
    end_date: filters.end_date,
    filter_state: filters.filter_state,
    filter_property_id: filters.filter_property_id,
    filter_lease_status: filters.filter_lease_status,
    filter_doc_type: filters.filter_doc_type,
  });
}

/* ============================================================
   ✔ 5. Audit trail helper (clean & reusable)
============================================================ */
export async function audit(
  session: any,
  req: Request,
  action: string,
  tableName = "dashboard"
) {
  if (!session?.user) return;

  try {
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: action.toUpperCase(),
      tableName,
      description: action,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });
  } catch (err) {
    console.error("❌ Audit logging failed:", err);
  }
}
