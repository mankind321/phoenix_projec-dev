/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// --------------------------------------------------
// 🔐 Create RLS-Aware Supabase Client
// --------------------------------------------------
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

/* =================================================================
GET /api/properties/broker/[id]

id = contact_assignment_id

Returns:
- contact
- contact_assignment
================================================================= */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: assignmentId } = await context.params;

    if (!assignmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Broker assignment ID is required",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // Session
    // --------------------------------------------------

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // --------------------------------------------------
    // RLS Headers
    // --------------------------------------------------

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // --------------------------------------------------
    // 1. Get assignment
    // --------------------------------------------------

    const {
      data: assignment,
      error: assignmentErr,
    } = await supabase
      .from("contact_assignment")
      .select("*")
      .eq(
        "contact_assignment_id",
        assignmentId,
      )
      .single();

    if (assignmentErr) {
      console.error(
        "BROKER ASSIGNMENT FETCH ERROR:",
        assignmentErr,
      );

      return NextResponse.json(
        {
          success: false,
          error: assignmentErr.message,
        },
        { status: 500 },
      );
    }

    if (!assignment) {
      return NextResponse.json(
        {
          success: false,
          error: "Broker assignment not found",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // 2. Get contact
    // --------------------------------------------------

    const {
      data: contact,
      error: contactErr,
    } = await supabase
      .from("contact")
      .select("*")
      .eq(
        "contact_id",
        assignment.contact_id,
      )
      .single();

    if (contactErr) {
      console.error(
        "BROKER CONTACT FETCH ERROR:",
        contactErr,
      );

      return NextResponse.json(
        {
          success: false,
          error: contactErr.message,
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // 3. Audit
    // --------------------------------------------------

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "READ",
      tableName: "contact",
      recordId: contact.contact_id,
      description:
        `Viewed broker: ${contact.broker_name}`,
      ipAddress:
        req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent:
        req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        assignment,
      },
    });
  } catch (err: any) {
    console.error(
      "GET BROKER FATAL ERROR:",
      err,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err.message ??
          "Unexpected server error",
      },
      { status: 500 },
    );
  }
}

/* =================================================================
PUT /api/properties/broker/[id]

id = contact_assignment_id

Updates BOTH:

1. contact
2. contact_assignment
================================================================= */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: assignmentId } = await context.params;

    if (!assignmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Broker assignment ID is required",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // Session
    // --------------------------------------------------

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // --------------------------------------------------
    // Request body
    // --------------------------------------------------

    const body = await req.json();

    // --------------------------------------------------
    // Required fields
    // --------------------------------------------------

    const requiredFields = [
      "listing_company",
      "broker_name",
      "phone",
      "email",
    ];

    for (const field of requiredFields) {
      if (
        !body[field] ||
        String(body[field]).trim() === ""
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          { status: 400 },
        );
      }
    }

    // --------------------------------------------------
    // RLS Headers
    // --------------------------------------------------

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // ==================================================
    // 1. GET ASSIGNMENT
    // ==================================================

    const {
      data: existingAssignment,
      error: assignmentFetchErr,
    } = await supabase
      .from("contact_assignment")
      .select("*")
      .eq(
        "contact_assignment_id",
        assignmentId,
      )
      .single();

    if (assignmentFetchErr) {
      console.error(
        "ASSIGNMENT FETCH ERROR:",
        assignmentFetchErr,
      );

      return NextResponse.json(
        {
          success: false,
          error: assignmentFetchErr.message,
        },
        { status: 500 },
      );
    }

    if (!existingAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "Broker assignment not found",
        },
        { status: 404 },
      );
    }

    // ==================================================
    // 2. UPDATE CONTACT
    // ==================================================

    const contactUpdate = {
      listing_company:
        String(body.listing_company).trim(),

      broker_name:
        String(body.broker_name).trim(),

      phone:
        String(body.phone).trim(),

      email:
        String(body.email).trim(),

      website:
        body.website
          ? String(body.website).trim()
          : null,

      comments:
        body.comments
          ? String(body.comments).trim()
          : null,

      updated_by: session.user.id,

      updated_at:
        new Date().toISOString(),
    };

    const {
      data: updatedContact,
      error: contactUpdateErr,
    } = await supabase
      .from("contact")
      .update(contactUpdate)
      .eq(
        "contact_id",
        existingAssignment.contact_id,
      )
      .select("*")
      .single();

    if (contactUpdateErr) {
      console.error(
        "CONTACT UPDATE ERROR:",
        contactUpdateErr,
      );

      return NextResponse.json(
        {
          success: false,
          error: contactUpdateErr.message,
        },
        { status: 500 },
      );
    }

    // ==================================================
    // 3. UPDATE ASSIGNMENT
    // ==================================================

    const assignmentUpdate = {
      relationship:
        body.relationship ??
        body.relation_text ??
        existingAssignment.relationship ??
        "",

      comments:
        body.relation_comment ??
        existingAssignment.comments ??
        "",

      updated_by: session.user.id,

      updated_at:
        new Date().toISOString(),
    };

    const {
      data: updatedAssignment,
      error: assignmentUpdateErr,
    } = await supabase
      .from("contact_assignment")
      .update(assignmentUpdate)
      .eq(
        "contact_assignment_id",
        assignmentId,
      )
      .select("*")
      .single();

    if (assignmentUpdateErr) {
      console.error(
        "ASSIGNMENT UPDATE ERROR:",
        assignmentUpdateErr,
      );

      return NextResponse.json(
        {
          success: false,
          error: assignmentUpdateErr.message,
        },
        { status: 500 },
      );
    }

    // ==================================================
    // 4. AUDIT
    // ==================================================

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "contact",
      recordId: updatedContact.contact_id,
      description:
        `Updated broker: ${updatedContact.broker_name}`,
      ipAddress:
        req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent:
        req.headers.get("user-agent") ?? "Unknown",
    });

    // ==================================================
    // 5. RESPONSE
    // ==================================================

    return NextResponse.json({
      success: true,
      message: "Broker updated successfully",
      data: {
        ...updatedContact,
        assignment: updatedAssignment,
      },
    });
  } catch (err: any) {
    console.error(
      "PUT BROKER FATAL ERROR:",
      err,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err.message ??
          "Unexpected server error",
      },
      { status: 500 },
    );
  }
}

/* =================================================================
DELETE /api/properties/broker/[id]

id = contact_assignment_id

IMPORTANT:
This removes the broker FROM THE PROPERTY.

It does NOT delete the contact master record.

The broker may be assigned to another property or lease.
================================================================= */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: assignmentId } = await context.params;

    if (!assignmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Broker assignment ID is required",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // Session
    // --------------------------------------------------

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // --------------------------------------------------
    // RLS Headers
    // --------------------------------------------------

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // ==================================================
    // 1. FETCH ASSIGNMENT
    // ==================================================

    const {
      data: assignment,
      error: assignmentFetchErr,
    } = await supabase
      .from("contact_assignment")
      .select("*")
      .eq(
        "contact_assignment_id",
        assignmentId,
      )
      .single();

    if (assignmentFetchErr) {
      console.error(
        "ASSIGNMENT FETCH ERROR:",
        assignmentFetchErr,
      );

      return NextResponse.json(
        {
          success: false,
          error: assignmentFetchErr.message,
        },
        { status: 500 },
      );
    }

    if (!assignment) {
      return NextResponse.json(
        {
          success: false,
          error: "Broker assignment not found",
        },
        { status: 404 },
      );
    }

    // ==================================================
    // 2. FETCH CONTACT FOR AUDIT
    // ==================================================

    const {
      data: contact,
      error: contactFetchErr,
    } = await supabase
      .from("contact")
      .select(
        "contact_id, broker_name, listing_company",
      )
      .eq(
        "contact_id",
        assignment.contact_id,
      )
      .maybeSingle();

    if (contactFetchErr) {
      console.error(
        "CONTACT FETCH ERROR:",
        contactFetchErr,
      );
    }

    // ==================================================
    // 3. DELETE ASSIGNMENT ONLY
    // ==================================================

    const {
      error: deleteErr,
    } = await supabase
      .from("contact_assignment")
      .delete()
      .eq(
        "contact_assignment_id",
        assignmentId,
      );

    if (deleteErr) {
      console.error(
        "ASSIGNMENT DELETE ERROR:",
        deleteErr,
      );

      return NextResponse.json(
        {
          success: false,
          error: deleteErr.message,
        },
        { status: 500 },
      );
    }

    // ==================================================
    // 4. AUDIT
    // ==================================================

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "DELETE",
      tableName: "contact_assignment",
      recordId: assignmentId,
      description:
        `Removed broker from property: ${
          contact?.broker_name ??
          assignment.contact_id
        }`,
      ipAddress:
        req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent:
        req.headers.get("user-agent") ?? "Unknown",
    });

    // ==================================================
    // 5. RESPONSE
    // ==================================================

    return NextResponse.json({
      success: true,
      message: "Broker removed from property successfully",
    });
  } catch (err: any) {
    console.error(
      "DELETE BROKER FATAL ERROR:",
      err,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err.message ??
          "Unexpected server error",
      },
      { status: 500 },
    );
  }
}