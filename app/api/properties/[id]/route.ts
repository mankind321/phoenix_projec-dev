import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";
process.env.GAX_GCN_DISALLOW_IPv6 = "true";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";
import { Storage } from "@google-cloud/storage";

// ----------------------------------------------
// 🔐 HEADER-BASED RLS SUPABASE CLIENT
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

// ----------------------------------------------
// ☁️ GCP STORAGE + SIGNED URL HELPER
// ----------------------------------------------
const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!,
);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

async function getSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  try {
    const [url] = await bucket.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return url;
  } catch (err) {
    console.error("Signed URL failed:", err);
    return null;
  }
}

// ----------------------------------------------
// 📌 GET — PROPERTY DETAILS
// ----------------------------------------------
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "Property ID is required" },
        { status: 400 },
      );
    }

    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ Supabase client
    const supabase = createRlsClient(rlsHeaders);

    // ----------------------------------------------
    // 4️⃣ Fetch PROPERTY (SAFE)
    // ----------------------------------------------
    const { data: property } = await supabase
      .from("view_property_with_user")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!property) {
      return NextResponse.json(
        { success: false, message: "Property not found" },
        { status: 404 },
      );
    }

    // ----------------------------------------------
    // 5️⃣ Fetch leases
    // ----------------------------------------------
    const [{ data: activeLeases }, { data: expiredLeases }] = await Promise.all(
      [
        supabase
          .from("lease")
          .select("*")
          .eq("property_id", propertyId)
          .or(
            "status.ilike.active," +
              "status.ilike.occupied," +
              "status.ilike.current," +
              "status.ilike.running," +
              "status.ilike.effective," +
              "status.ilike.ongoing," +
              "status.ilike.leased," +
              "status.ilike.available",
          ),
        supabase
          .from("lease")
          .select("*")
          .eq("property_id", propertyId)
          .or(
            "status.ilike.expired," +
              "status.ilike.terminated," +
              "status.ilike.ended," +
              "status.ilike.closed," +
              "status.ilike.inactive",
          ),
      ],
    );

    // ----------------------------------------------
    // 6️⃣ Fetch images
    // ----------------------------------------------
    const { data: documents, error: documentError } = await supabase
      .from("document")
      .select("file_url, doc_type")
      .eq("property_id", propertyId)
      .eq("doc_type", "Image")
      .order("created_at", { ascending: false });

    if (documentError) throw documentError;

    const signedDocuments = await Promise.all(
      (documents ?? []).map(async (doc) => ({
        ...doc,
        file_url: await getSignedUrl(doc.file_url),
      })),
    );

    // ----------------------------------------------
    // 7️⃣ Fetch contacts
    // ----------------------------------------------
    const { data: contacts, error: contactError } = await supabase
      .from("contact_with_assignment")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (contactError) throw contactError;

    // ----------------------------------------------
    // 8️⃣ Fetch latest document (OPTIONAL)
    // ----------------------------------------------
    const { data: documentFiles, error: documentFilesError } = await supabase
      .from("document")
      .select("file_url, doc_type")
      .eq("property_id", propertyId)
      .is("lease_id", null) // <-- add this
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (documentFilesError) throw documentFilesError;

    const signedDocumentFiles = documentFiles
      ? {
          ...documentFiles,
          file_url: await getSignedUrl(documentFiles.file_url),
        }
      : null;

    // ----------------------------------------------
    // 9️⃣ Audit log
    // ----------------------------------------------
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "READ",
      tableName: "property",
      description: `Viewed property: ${property.name}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // ----------------------------------------------
    // 🔟 Response
    // ----------------------------------------------
    return NextResponse.json({
      success: true,
      data: {
        property,
        leases: {
          active: activeLeases,
          expired: expiredLeases,
        },
        documents: signedDocuments,
        documentFiles: signedDocumentFiles,
        contacts,
      },
    });
  } catch (err: any) {
    console.error("GET /property/[id] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 },
    );
  }
}

// ----------------------------------------------
// ❌ DELETE — PROPERTY
// ----------------------------------------------
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "Property ID is required" },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // ----------------------------------------------
    // Fetch property safely
    // ----------------------------------------------
    const { data: property } = await supabase
      .from("property")
      .select("property_id, name")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!property) {
      return NextResponse.json(
        { success: false, message: "Property not found" },
        { status: 404 },
      );
    }

    // ----------------------------------------------
    // Delete
    // ----------------------------------------------
    const { error: deleteError } = await supabase
      .from("property")
      .delete()
      .eq("property_id", propertyId);

    if (deleteError) throw deleteError;

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "DELETE",
      tableName: "property",
      description: `Deleted property: ${property.name}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (err: any) {
    console.error("DELETE /property/[id] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 },
    );
  }
}

// ----------------------------------------------
// 🌍 GEOCODE HELPER
// ----------------------------------------------
async function geocodeAddress(address: string) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY_BACKEND;
    if (!apiKey) {
      console.warn("Missing GOOGLE_MAPS_API_KEY");
      return null;
    }

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address,
      )}&key=${apiKey}`,
    );

    const data = await res.json();

    if (!data.results || data.results.length === 0) return null;

    const loc = data.results[0].geometry.location;
    return {
      latitude: loc.lat,
      longitude: loc.lng,
    };
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}

// ----------------------------------------------
// ✏️ PUT — UPDATE PROPERTY
// ----------------------------------------------
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "Property ID is required" },
        { status: 400 },
      );
    }

    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 3️⃣ Parse body
    const body = await req.json();

    // ----------------------------------------------
    // 🧠 Normalize payload
    // ----------------------------------------------
    const payload: any = {
      name: body.name ?? null,
      type: body.type ?? null,
      landlord: body.landlord ?? null,
      status: body.status ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      price: body.price ? Number(body.price) : null,
      cap_rate: normalizeCapRate(body.cap_rate),
      sale_date: body.sale_date || null,
      comments: body.comments ?? null,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    // ----------------------------------------------
    // 🔍 Check existing property (INCLUDE ADDRESS)
    // ----------------------------------------------
    const { data: existingProperty, error: fetchError } = await supabase
      .from("property")
      .select("property_id, name, address, city, state")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!existingProperty) {
      return NextResponse.json(
        { success: false, message: "Property not found" },
        { status: 404 },
      );
    }

    // ----------------------------------------------
    // 🌍 AUTO GEOCODE (ONLY IF ADDRESS CHANGED)
    // ----------------------------------------------
    const addressChanged =
      payload.address !== existingProperty.address ||
      payload.city !== existingProperty.city ||
      payload.state !== existingProperty.state;
    
    if (addressChanged && payload.address) {
      const fullAddress = `${payload.address}, ${payload.city}, ${payload.state}`;

      const geo = await geocodeAddress(fullAddress);

      if (geo) {
        payload.latitude = geo.latitude;
        payload.longitude = geo.longitude;
      }
    }
    // ----------------------------------------------
    // ✏️ UPDATE PROPERTY
    // ----------------------------------------------
    const { data: updatedProperty, error: updateError } = await supabase
      .from("property")
      .update(payload)
      .eq("property_id", propertyId)
      .select()
      .single();

    if (updateError) throw updateError;

    // ----------------------------------------------
    // 🧾 Audit log
    // ----------------------------------------------
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "property",
      description: `Updated property: ${existingProperty.name}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // ----------------------------------------------
    // ✅ RESPONSE
    // ----------------------------------------------
    return NextResponse.json({
      success: true,
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (err: any) {
    console.error("PUT /property/[id] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 },
    );
  }
}

function normalizeCapRate(value: any): string | null {
  if (!value) return null;

  let str = String(value).trim();

  // Remove spaces
  str = str.replace(/\s+/g, "");

  // Ensure % exists
  const parts = str.split("/").map((p) => {
    const num = p.replace("%", "");

    if (isNaN(Number(num))) return null;

    return `${Number(num)}%`;
  });

  const valid = parts.filter(Boolean);

  if (valid.length === 0) return null;

  return valid.join("/");
}
