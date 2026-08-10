/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditTrail } from "@/lib/auditLogger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ----------------------------------------------
// 🔐 Create Supabase client using HEADER-BASED RLS
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

/* ==========================================================
📌 POST — CREATE CONTACT + ASSIGNMENT
   OR
📌 POST — COMMIT PENDING BROKER CHANGES DURING APPROVAL

Normal create payload:

{
  listing_company,
  broker_name,
  phone,
  email,
  website,
  comments,
  property_id,
  lease_id,
  relation_text,
  relation_comment
}

Approval payload:

{
  property_id,
  changes: [
    {
      action: "create",
      temp_id: "...",
      listing_company,
      broker_name,
      phone,
      email,
      website,
      relationship,
      comments
    },
    {
      action: "update",
      contact_assignment_id,
      listing_company,
      broker_name,
      phone,
      email,
      website,
      relationship,
      comments
    },
    {
      action: "delete",
      contact_assignment_id
    }
  ]
}
========================================================== */

export async function POST(req: Request) {
  try {
    // =====================================================
    // 1. VALIDATE SESSION
    // =====================================================

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

    // =====================================================
    // 2. RLS HEADERS
    // =====================================================

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // =====================================================
    // 3. PARSE BODY
    // =====================================================

    const body = await req.json();

    /*
     * ====================================================
     * APPROVAL MODE
     *
     * If "changes" exists, this request is coming from
     * the Review Property -> Approve workflow.
     * ====================================================
     */

    if (Array.isArray(body.changes)) {
      const propertyId = body.property_id;

      if (!propertyId) {
        return NextResponse.json(
          {
            success: false,
            message: "property_id is required",
          },
          { status: 400 },
        );
      }

      const changes = body.changes;

      // Nothing to commit
      if (changes.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No broker changes to save",
          data: [],
        });
      }

      const results: any[] = [];

      // ===================================================
      // PROCESS EACH PENDING CHANGE
      // ===================================================

      for (const change of changes) {
        const action = change.action;

        // =================================================
        // CREATE
        // =================================================

        if (action === "create") {
          if (
            !change.broker_name ||
            !String(change.broker_name).trim()
          ) {
            throw new Error(
              "Broker Name is required for create operation",
            );
          }

          if (
            !change.listing_company ||
            !String(change.listing_company).trim()
          ) {
            throw new Error(
              "Listing Company is required for create operation",
            );
          }

          if (
            !change.phone ||
            !String(change.phone).trim()
          ) {
            throw new Error(
              "Phone is required for create operation",
            );
          }

          if (
            !change.email ||
            !String(change.email).trim()
          ) {
            throw new Error(
              "Email is required for create operation",
            );
          }

          // -----------------------------------------------
          // Create contact
          // -----------------------------------------------

          const contactId = crypto.randomUUID();
          const uniqueId = crypto.randomUUID();

          const newContact = {
            contact_id: contactId,
            unique_id: uniqueId,
            user_id: session.user.id,

            created_by: session.user.id,
            updated_by: session.user.id,

            listing_company:
              String(change.listing_company).trim(),

            broker_name:
              String(change.broker_name).trim(),

            phone:
              String(change.phone).trim(),

            email:
              String(change.email).trim(),

            website:
              change.website
                ? String(change.website).trim()
                : null,

            comments:
              change.comments
                ? String(change.comments).trim()
                : null,
          };

          const {
            data: savedContact,
            error: contactError,
          } = await supabase
            .from("contact")
            .insert(newContact)
            .select("*")
            .single();

          if (contactError) {
            console.error(
              "Broker contact create error:",
              contactError,
            );

            throw new Error(
              `Failed to create broker: ${contactError.message}`,
            );
          }

          // -----------------------------------------------
          // Create property assignment
          // -----------------------------------------------

          const assignmentPayload = {
            contact_id: savedContact.contact_id,

            user_id: session.user.id,

            property_id: propertyId,

            lease_id: change.lease_id ?? null,

            relationship:
              change.relationship ??
              change.relation_text ??
              "",

            comments:
              change.comments ??
              change.relation_comment ??
              "",

            created_by: session.user.id,
            updated_by: session.user.id,
            updated_at: new Date().toISOString(),
          };

          const {
            data: assignment,
            error: assignmentError,
          } = await supabase
            .from("contact_assignment")
            .insert(assignmentPayload)
            .select("*")
            .single();

          if (assignmentError) {
            console.error(
              "Broker assignment create error:",
              assignmentError,
            );

            /*
             * Best-effort cleanup because contact was already
             * created and assignment failed.
             */
            await supabase
              .from("contact")
              .delete()
              .eq("contact_id", savedContact.contact_id);

            throw new Error(
              `Failed to assign broker: ${assignmentError.message}`,
            );
          }

          // -----------------------------------------------
          // Audit
          // -----------------------------------------------

          await logAuditTrail({
            userId: session.user.id,
            username: session.user.username,
            role: session.user.role,
            actionType: "CREATE",
            tableName: "contact",
            recordId: savedContact.contact_id,
            description:
              `Created broker during property approval: ${savedContact.broker_name}`,
            ipAddress:
              req.headers.get("x-forwarded-for") ?? "N/A",
            userAgent:
              req.headers.get("user-agent") ?? "Unknown",
          });

          results.push({
            action: "create",
            contact: savedContact,
            assignment,
          });

          continue;
        }

        // =================================================
        // UPDATE
        // =================================================

        if (action === "update") {
          const assignmentId =
            change.contact_assignment_id;

          if (!assignmentId) {
            throw new Error(
              "contact_assignment_id is required for update",
            );
          }

          // -----------------------------------------------
          // Verify assignment belongs to property
          // -----------------------------------------------

          const {
            data: assignment,
            error: assignmentFetchError,
          } = await supabase
            .from("contact_assignment")
            .select(
              `
              contact_assignment_id,
              contact_id,
              property_id,
              lease_id,
              relationship,
              comments
              `,
            )
            .eq(
              "contact_assignment_id",
              assignmentId,
            )
            .eq("property_id", propertyId)
            .maybeSingle();

          if (assignmentFetchError) {
            console.error(
              "Assignment lookup error:",
              assignmentFetchError,
            );

            throw new Error(
              assignmentFetchError.message,
            );
          }

          if (!assignment) {
            throw new Error(
              "Broker assignment was not found for this property",
            );
          }

          // -----------------------------------------------
          // Update contact
          // -----------------------------------------------

          const contactUpdate: Record<string, any> = {
            updated_by: session.user.id,
            updated_at: new Date().toISOString(),
          };

          if (change.listing_company !== undefined) {
            contactUpdate.listing_company =
              String(change.listing_company).trim();
          }

          if (change.broker_name !== undefined) {
            contactUpdate.broker_name =
              String(change.broker_name).trim();
          }

          if (change.phone !== undefined) {
            contactUpdate.phone =
              String(change.phone).trim();
          }

          if (change.email !== undefined) {
            contactUpdate.email =
              String(change.email).trim();
          }

          if (change.website !== undefined) {
            contactUpdate.website =
              change.website
                ? String(change.website).trim()
                : null;
          }

          /*
           * IMPORTANT:
           * "comments" here belongs to the CONTACT.
           */
          if (change.comments !== undefined) {
            contactUpdate.comments =
              change.comments
                ? String(change.comments).trim()
                : null;
          }

          const {
            data: updatedContact,
            error: contactUpdateError,
          } = await supabase
            .from("contact")
            .update(contactUpdate)
            .eq(
              "contact_id",
              assignment.contact_id,
            )
            .select("*")
            .single();

          if (contactUpdateError) {
            console.error(
              "Contact update error:",
              contactUpdateError,
            );

            throw new Error(
              `Failed to update broker: ${contactUpdateError.message}`,
            );
          }

          // -----------------------------------------------
          // Update assignment
          // -----------------------------------------------

          const assignmentUpdate: Record<string, any> = {
            updated_by: session.user.id,
            updated_at: new Date().toISOString(),
          };

          if (
            change.relationship !== undefined ||
            change.relation_text !== undefined
          ) {
            assignmentUpdate.relationship =
              change.relationship ??
              change.relation_text ??
              "";
          }

          /*
           * If your assignment comments are separate from
           * contact comments, use relation_comment first.
           */
          if (
            change.relation_comment !== undefined
          ) {
            assignmentUpdate.comments =
              change.relation_comment
                ? String(change.relation_comment).trim()
                : "";
          }

          const {
            data: updatedAssignment,
            error: assignmentUpdateError,
          } = await supabase
            .from("contact_assignment")
            .update(assignmentUpdate)
            .eq(
              "contact_assignment_id",
              assignmentId,
            )
            .eq("property_id", propertyId)
            .select("*")
            .single();

          if (assignmentUpdateError) {
            console.error(
              "Assignment update error:",
              assignmentUpdateError,
            );

            throw new Error(
              `Failed to update broker assignment: ${assignmentUpdateError.message}`,
            );
          }

          // -----------------------------------------------
          // Audit
          // -----------------------------------------------

          await logAuditTrail({
            userId: session.user.id,
            username: session.user.username,
            role: session.user.role,
            actionType: "UPDATE",
            tableName: "contact",
            recordId: updatedContact.contact_id,
            description:
              `Updated broker during property approval: ${updatedContact.broker_name}`,
            ipAddress:
              req.headers.get("x-forwarded-for") ?? "N/A",
            userAgent:
              req.headers.get("user-agent") ?? "Unknown",
          });

          results.push({
            action: "update",
            contact: updatedContact,
            assignment: updatedAssignment,
          });

          continue;
        }

        // =================================================
        // DELETE / REMOVE ASSIGNMENT
        // =================================================

        if (action === "delete") {
          const assignmentId =
            change.contact_assignment_id;

          if (!assignmentId) {
            throw new Error(
              "contact_assignment_id is required for delete",
            );
          }

          // -----------------------------------------------
          // Verify assignment belongs to property
          // -----------------------------------------------

          const {
            data: assignment,
            error: assignmentFetchError,
          } = await supabase
            .from("contact_assignment")
            .select(
              `
              contact_assignment_id,
              contact_id,
              property_id
              `,
            )
            .eq(
              "contact_assignment_id",
              assignmentId,
            )
            .eq("property_id", propertyId)
            .maybeSingle();

          if (assignmentFetchError) {
            throw new Error(
              assignmentFetchError.message,
            );
          }

          if (!assignment) {
            throw new Error(
              "Broker assignment was not found for this property",
            );
          }

          // -----------------------------------------------
          // Get broker name for audit
          // -----------------------------------------------

          const {
            data: contact,
          } = await supabase
            .from("contact")
            .select("contact_id, broker_name")
            .eq(
              "contact_id",
              assignment.contact_id,
            )
            .maybeSingle();

          // -----------------------------------------------
          // IMPORTANT:
          //
          // Delete ONLY the assignment.
          //
          // Do NOT delete the contact master record.
          // The broker may be assigned to another property.
          // -----------------------------------------------

          const {
            error: assignmentDeleteError,
          } = await supabase
            .from("contact_assignment")
            .delete()
            .eq(
              "contact_assignment_id",
              assignmentId,
            )
            .eq("property_id", propertyId);

          if (assignmentDeleteError) {
            console.error(
              "Assignment delete error:",
              assignmentDeleteError,
            );

            throw new Error(
              `Failed to remove broker: ${assignmentDeleteError.message}`,
            );
          }

          // -----------------------------------------------
          // Audit
          // -----------------------------------------------

          await logAuditTrail({
            userId: session.user.id,
            username: session.user.username,
            role: session.user.role,
            actionType: "DELETE",
            tableName: "contact_assignment",
            recordId: assignmentId,
            description:
              `Removed broker from property: ${
                contact?.broker_name ?? assignment.contact_id
              }`,
            ipAddress:
              req.headers.get("x-forwarded-for") ?? "N/A",
            userAgent:
              req.headers.get("user-agent") ?? "Unknown",
          });

          results.push({
            action: "delete",
            contact_assignment_id: assignmentId,
          });

          continue;
        }

        // =================================================
        // INVALID ACTION
        // =================================================

        throw new Error(
          `Unsupported broker action: ${action}`,
        );
      }

      // =====================================================
      // SUCCESS
      // =====================================================

      return NextResponse.json({
        success: true,
        message: "Broker changes saved successfully",
        data: results,
      });
    }

    /*
     * ====================================================
     * NORMAL CREATE MODE
     *
     * This preserves your existing POST /broker behavior.
     * ====================================================
     */

    const required = [
      "listing_company",
      "broker_name",
      "phone",
      "email",
    ];

    for (const field of required) {
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

    // =====================================================
    // CREATE CONTACT
    // =====================================================

    const newContact = {
      contact_id: crypto.randomUUID(),
      unique_id: crypto.randomUUID(),

      user_id: session.user.id,

      created_by: session.user.id,
      updated_by: session.user.id,

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
    };

    const {
      data: savedContact,
      error: contactErr,
    } = await supabase
      .from("contact")
      .insert(newContact)
      .select("*")
      .single();

    if (contactErr) {
      console.error(
        "Supabase Insert Error:",
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

    // =====================================================
    // CREATE ASSIGNMENT
    // =====================================================

    const assignmentPayload = {
      contact_id: savedContact.contact_id,

      user_id: session.user.id,

      property_id: body.property_id || null,

      lease_id: body.lease_id || null,

      relationship:
        body.relation_text ??
        body.relationship ??
        "",

      comments:
        body.relation_comment ??
        "",

      created_by: session.user.id,
      updated_by: session.user.id,

      updated_at: new Date().toISOString(),
    };

    const {
      data: assignment,
      error: assignmentErr,
    } = await supabase
      .from("contact_assignment")
      .insert(assignmentPayload)
      .select("*")
      .single();

    if (assignmentErr) {
      console.error(
        "Assignment Insert Error:",
        assignmentErr,
      );

      // Cleanup contact if assignment fails
      await supabase
        .from("contact")
        .delete()
        .eq(
          "contact_id",
          savedContact.contact_id,
        );

      return NextResponse.json(
        {
          success: false,
          error: assignmentErr.message,
        },
        { status: 500 },
      );
    }

    // =====================================================
    // AUDIT
    // =====================================================

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "CREATE",
      tableName: "contact",
      recordId: savedContact.contact_id,
      description:
        `Created new contact (${savedContact.broker_name})`,
      ipAddress:
        req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent:
        req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data: savedContact,
      assignment,
    });
  } catch (err: any) {
    console.error("POST Broker Error:", err);

    return NextResponse.json(
      {
        success: false,
        message:
          err.message ||
          "Unexpected server error",
      },
      { status: 500 },
    );
  }
}