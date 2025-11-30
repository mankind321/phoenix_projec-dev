import { NextResponse } from "next/server";
import { logAuditTrail } from "@/lib/auditLogger";

export async function GET() {
  await logAuditTrail({
    userId: "test-user-id",
    username: "rodel",
    role: "admin",
    actionType: "TEST_INSERT",
    tableName: "accounts",
    description: "Testing logAuditTrail from backend",
    ipAddress: "127.0.0.1",
    userAgent: "Postman",
  });

  return NextResponse.json({ status: "OK" });
}
