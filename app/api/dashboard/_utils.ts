/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

/* ============================================================
   ✔ Allow Any Supabase Schema (Fixes Type Error)
============================================================ */
export type AnySupabaseClient = SupabaseClient<any, any, any>;

/* ============================================================
   🔐 Create Supabase Client WITH HEADER-BASED RLS
============================================================ */
export function createRlsClient(headers: Record<string, string>): AnySupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

/* ============================================================
   🔐 AUTHENTICATION + RLS HEADER GENERATION
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

  const rlsHeaders = {
    "x-user-id": String(session.user.id),
    "x-app-role": String(session.user.role),
    "x-account-id": String(session.user.accountId ?? ""),
  };

  const supabase = createRlsClient(rlsHeaders);

  return {
    authorized: true,
    session,
    supabase,
  };
}

/* ============================================================
   📅 GLOBAL DATE FILTER HANDLER
   Converts query parameters into clean RPC-safe values
============================================================ */
export function parseDateFilters(req: Request) {
  const { searchParams } = new URL(req.url);

  const start_date_raw = searchParams.get("start_date");
  const end_date_raw = searchParams.get("end_date");

  return {
    start_date: start_date_raw && start_date_raw.trim() !== "" ? start_date_raw : null,
    end_date: end_date_raw && end_date_raw.trim() !== "" ? end_date_raw : null,
  };
}

/* ============================================================
   📝 AUDIT LOGGING (Logs to system_audit_trail)
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
