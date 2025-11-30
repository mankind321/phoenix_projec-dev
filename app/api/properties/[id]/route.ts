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
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // REQUIRED for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

// ----------------------------------------------
// ☁️ GCP STORAGE + SIGNED URL HELPER
// ----------------------------------------------
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

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
// 📌 GET — EVERY USER CAN ACCESS PROPERTY DETAILS
// ----------------------------------------------
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "Property ID is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Build RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 3️⃣ Supabase RLS client
    const supabase = createRlsClient(rlsHeaders);

    // ----------------------------------------------
    // 4️⃣ Fetch PROPERTY
    // ----------------------------------------------
    const { data: property, error: propertyError } = await supabase
      .from("property")
      .select("*")
      .eq("property_id", propertyId)
      .single();

    if (propertyError) throw propertyError;

    // ----------------------------------------------
    // 5️⃣ Fetch ACTIVE leases
    // ----------------------------------------------
    const { data: activeLeases } = await supabase
      .from("lease")
      .select("*")
      .eq("property_id", propertyId)
      .eq("status", "active");

    // ----------------------------------------------
    // 6️⃣ Fetch EXPIRED leases
    // ----------------------------------------------
    const { data: expiredLeases } = await supabase
      .from("lease")
      .select("*")
      .eq("property_id", propertyId)
      .eq("status", "expired");

    // ----------------------------------------------
    // 7️⃣ Fetch ONLY images from document table
    // ----------------------------------------------
    const { data: documents, error: documentError } = await supabase
      .from("document")
      .select("file_url, doc_type")
      .eq("property_id", propertyId)
      .eq("doc_type", "Image")
      .order("created_at", { ascending: false });

    if (documentError) throw documentError;

    // ----------------------------------------------
    // 7️⃣ Fetch ONLY images from document table
    // ----------------------------------------------
    const { data: contacts, error: contactError } = await supabase
      .from("contact_with_assignment")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (contactError) throw contactError;

    // ----------------------------------------------
    // 8️⃣ Generate SIGNED URLs
    // ----------------------------------------------
    const signedDocuments = await Promise.all(
      (documents ?? []).map(async (doc) => ({
        ...doc,
        file_url: await getSignedUrl(doc.file_url),
      }))
    );

    // ----------------------------------------------
    // 9️⃣ Audit Log
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
    // 🔟 Return Full Response
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
        contacts: contacts,
      },
    });
  } catch (err: any) {
    console.error("GET /property/[id] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
