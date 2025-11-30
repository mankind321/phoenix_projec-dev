/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logAuditTrail } from "@/lib/auditLogger";

// --------------------------------------------------
// 🔐 Create RLS-Aware Supabase Client (Headers-Based)
// --------------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

/* =================================================================
   GET /api/contacts/[id]
   RETURNS: contact + contact_assignment
================================================================= */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await context.params;

    if (!contactId) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS Headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // -----------------------------------------
    // 1️⃣ FETCH MAIN CONTACT
    // -----------------------------------------
    const { data: contact, error: contactErr } = await supabase
      .from("contact")
      .select("*")
      .eq("contact_id", contactId)
      .single();

    if (contactErr) {
      return NextResponse.json({ error: contactErr.message }, { status: 500 });
    }

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found or access denied" },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // 2️⃣ FETCH ASSIGNMENT (can be null)
    // -----------------------------------------
    const { data: assignment, error: assignmentErr } = await supabase
      .from("contact_assignment")
      .select("*")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (assignmentErr && assignmentErr.code !== "PGRST116") {
      console.log("Assignment fetch error:", assignmentErr.message);
    }

    // -----------------------------------------
    // 3️⃣ AUDIT
    // -----------------------------------------
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "READ",
      tableName: "contact",
      description: `Viewed contact: ${contact.broker_name}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        assignment: assignment ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}

/* =================================================================
   PUT /api/contacts/[id]
   Updates BOTH:
   1. contact
   2. contact_assignment (upsert)
================================================================= */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await context.params;

    if (!contactId) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Required fields
    const requiredFields = [
      "listing_company",
      "broker_name",
      "phone",
      "email",
      "website",
      "comments",
    ];

    for (const field of requiredFields) {
      if (!body[field] || String(body[field]).trim() === "") {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };
    const supabase = createRlsClient(rlsHeaders);

    //
    // 1️⃣ UPDATE CONTACT
    //
    const updatedContact = {
      listing_company: body.listing_company,
      broker_name: body.broker_name,
      phone: body.phone,
      email: body.email,
      website: body.website,
      comments: body.comments,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await supabase
      .from("contact")
      .update(updatedContact)
      .eq("contact_id", contactId)
      .select("*")
      .single();

    if (updateErr) {
      console.log("CONTACT UPDATE ERROR:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    //
    // 2️⃣ CHECK IF ASSIGNMENT EXISTS
    //
    const { data: existingAssignment, error: fetchErr } = await supabase
      .from("contact_assignment")
      .select("contact_id")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== "PGRST116") {
      console.log("ASSIGNMENT FETCH ERROR:", fetchErr);
    }

    //
    // Payload shared by insert & update
    //
    const assignmentPayload = {
      contact_id: contactId,
      user_id: session.user.id,
      property_id: body.property_id || null,
      lease_id: body.lease_id || null,
      relationship: body.relation_text ?? "",
      comments: body.relation_comment ?? "",
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    //
    // 3️⃣ UPDATE ASSIGNMENT IF EXISTS
    //
    if (existingAssignment) {
      console.log("UPDATING EXISTING ASSIGNMENT...");
      const { error: updateAssignErr } = await supabase
        .from("contact_assignment")
        .update(assignmentPayload)
        .eq("contact_id", contactId);

      if (updateAssignErr) {
        console.log("ASSIGNMENT UPDATE ERROR:", updateAssignErr);
        return NextResponse.json({ error: updateAssignErr.message }, { status: 500 });
      }
    }

    //
    // 4️⃣ INSERT ASSIGNMENT IF NOT EXISTS
    //
    else {
      console.log("INSERTING NEW ASSIGNMENT...");
      const insertPayload = {
        ...assignmentPayload,
        created_by: session.user.id,
      };

      const { error: insertErr } = await supabase
        .from("contact_assignment")
        .insert(insertPayload);

      if (insertErr) {
        console.log("ASSIGNMENT INSERT ERROR:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    //
    // 5️⃣ AUDIT LOG
    //
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "contact",
      description: `Updated contact & assignment: ${body.broker_name}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Contact updated successfully",
    });
  } catch (err: any) {
    console.log("PUT FATAL ERROR:", err);
    return NextResponse.json(
      { error: err.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}


/* =================================================================
   DELETE /api/contacts/[id]
   Deletes BOTH:
   1. contact_assignment
   2. contact
================================================================= */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await context.params;

    if (!contactId) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

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

    // -----------------------------------------
    // 1️⃣ Fetch old contact for audit logging
    // -----------------------------------------
    const { data: oldContact } = await supabase
      .from("contact")
      .select("*")
      .eq("contact_id", contactId)
      .single();

    if (!oldContact) {
      return NextResponse.json(
        { error: "Contact not found or access denied" },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // 2️⃣ Delete assignment first
    // -----------------------------------------
    await supabase
      .from("contact_assignment")
      .delete()
      .eq("contact_id", contactId);

    // -----------------------------------------
    // 3️⃣ Delete the contact
    // -----------------------------------------
    const { error: deleteErr } = await supabase
      .from("contact")
      .delete()
      .eq("contact_id", contactId);

    if (deleteErr) {
      return NextResponse.json(
        { error: deleteErr.message },
        { status: 403 }
      );
    }

    // -----------------------------------------
    // Audit
    // -----------------------------------------
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "DELETE",
      tableName: "contact",
      description: `Deleted contact: ${oldContact.broker_name}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
