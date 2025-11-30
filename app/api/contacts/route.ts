/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditTrail } from "@/lib/auditLogger";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// ----------------------------------------------
// 🔐 Create Supabase client using HEADER-BASED RLS
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // MUST use service role
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

// Allowed sort fields
const ALLOWED_SORT_FIELDS = new Set([
  "created_at",
  "updated_at",
  "broker_name",
  "listing_company",
  "agent_name",
]);

/* ==========================================================
   📌 GET — Fetch Contacts (EVERY USER CAN VIEW)
========================================================== */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // Audit log
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "VIEW",
      tableName: "view_contact_user",
      description: "Viewed contact list",
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // Query params
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 10);
    const offset = (page - 1) * pageSize;

    const search = searchParams.get("search")?.trim() || "";
    const sortField = ALLOWED_SORT_FIELDS.has(searchParams.get("sortField") ?? "")
      ? String(searchParams.get("sortField"))
      : "created_at";
    const sortOrder =
      searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    let query = supabase
      .from("view_contact_user")
      .select(
        `
        contact_id,
        unique_id,
        user_id,
        agent_name,
        listing_company,
        broker_name,
        phone,
        email,
        website,
        comments,
        created_by,
        createdbyuser,
        updated_by,
        updatedbyuser,
        created_at,
        updated_at
        `,
        { count: "exact" }
      )
      .order(sortField, { ascending: sortOrder === "asc" })
      .range(offset, offset + pageSize - 1);

    // Search filter
    if (search) {
      query = query.or(
        `broker_name.ilike.%${search}%,listing_company.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;
    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error("GET Error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

/* ==========================================================
   📌 POST — Create Contact + contact_assignment
========================================================== */
export async function POST(req: Request) {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);
    const body = await req.json();

    // 3️⃣ Validation
    const required = [
      "listing_company",
      "broker_name",
      "phone",
      "email",
      "website",
      "comments",
    ];

    for (const field of required) {
      if (!body[field] || body[field].trim() === "") {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // 4️⃣ Create main contact record
    const newContact = {
      contact_id: crypto.randomUUID(),
      unique_id: crypto.randomUUID(),
      user_id: session.user.id,
      created_by: session.user.id,
      updated_by: session.user.id,
      listing_company: body.listing_company,
      broker_name: body.broker_name,
      phone: body.phone,
      email: body.email,
      website: body.website,
      comments: body.comments,
    };

    const { data: savedContact, error: contactErr } = await supabase
      .from("contact")
      .insert(newContact)
      .select("*")
      .single();

    if (contactErr) {
      console.error("Supabase Insert Error:", contactErr);
      return NextResponse.json({ error: contactErr.message }, { status: 500 });
    }

    // 5️⃣ Create contact_assignment entry
    const assignmentPayload = {
      contact_id: savedContact.contact_id,
      user_id: session.user.id,
      property_id: body.property_id || null,
      lease_id: body.lease_id || null,
      relationship: body.relation_text ?? "",
      comments: body.relation_comment ?? "",
      created_by: session.user.id,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    const { error: assignmentErr } = await supabase
      .from("contact_assignment")
      .insert(assignmentPayload);

    if (assignmentErr) {
      console.error("Assignment Insert Error:", assignmentErr);
      return NextResponse.json({ error: assignmentErr.message }, { status: 500 });
    }

    // 6️⃣ Audit log
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "CREATE",
      tableName: "contact",
      description: `Created new contact (${body.broker_name})`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({ success: true, data: savedContact });
  } catch (err: any) {
    console.error("POST Error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
