/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

// ✅ Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function logAuditTrail({
  userId,
  username,
  role,
  actionType,
  tableName,
  recordId,
  description,
  ipAddress,
  userAgent,
}: {
  userId: string | null;
  username?: string;
  role?: string;
  actionType: string;
  tableName: string;
  recordId?: string;
  description?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    // 🧩 Actual insert
    const { error } = await supabase.from("system_audit_trail").insert([
      {
        user_id: userId,
        username,
        role,
        action_type: actionType,
        table_name: tableName,
        record_id: recordId,
        description,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    ]);

    if (error) {
      console.error("❌ [AuditLog] Insert failed:", error.message);
    } else {
      console.log("✅ [AuditLog] Insert succeeded!");
    }
  } catch (err: any) {
    console.error("⚠️ [AuditLog] Unexpected error:", err.message);
  }
}
